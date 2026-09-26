// 建筑式主城视图。复用 home 的任务/挂机业务，建筑占位美术独立于点击与数据。
// home.js 正在由英雄系统迭代维护；这里不复制或改写其奖励、存档逻辑。
const home = require('./home');
const { app, ui } = require('../app');
const art = require('../city-art');
const store = require('../../utils/store');
const F = require('../../utils/fmt');
const C = require('../../utils/config');

const INK = '#473d2d', MUTED = '#766a51', PAPER = '#e9dfc5';
// 未来可按 key 替换立绘，矩形同时限定占位建筑与可点击区域。
const BUILDINGS = [
  { key: 'summon', name: '点将台', hint: '召唤武将', kind: 'summon', x: 130, y: 40, w: 115, h: 91, id: 'home-summon', tab: 'summon' },
  { key: 'heroes', name: '群英殿', hint: '英雄养成', kind: 'hall', x: 28, y: 162, w: 108, h: 77, id: 'home-heroes', tab: 'heroes' },
  { key: 'arena', name: '演武场', hint: '对战切磋', kind: 'tower', x: 240, y: 157, w: 106, h: 82, id: 'city-arena', page: 'arena' },
  { key: 'forge', name: '军械图鉴', hint: '全军共用 · 六部位', kind: 'forge', x: 30, y: 284, w: 103, h: 71, id: 'city-forge', page: 'armory' },
  { key: 'shop', name: '集市', hint: '兑换物资', kind: 'market', x: 243, y: 282, w: 100, h: 73, id: 'city-shop', page: 'shop' },
  { key: 'formation', name: '军机营', hint: '调整编队', kind: 'camp', x: 139, y: 371, w: 98, h: 56, id: 'city-formation', page: 'formation' }
];

module.exports = {
  ...home,
  name: 'home', scroll: {}, scrollReg: {},
  draw() {
    const s = store.getState(), v = this.view;
    const mapY = 98, mapH = Math.max(100, app.H - 282), contentH = Math.max(470, mapH);
    const inset = Math.max(0, (contentH - 470) / 2);
    const ctx = ui.ctx;
    ctx.save(); ctx.fillStyle = PAPER; ctx.fillRect(0, 0, 375, app.H); ctx.restore();
    this.drawCityHeader(s, v);

    ui.beginScroll(this, 'town', 0, mapY, 375, mapH, contentH);
    art.drawGround(ctx, 0, mapY, 375, contentH);
    ui.text('桃 园 主 城', 187.5, mapY + 10, { size: 12, color: INK, bold: true, align: 'center' });
    BUILDINGS.forEach(b => {
      const y = mapY + inset + b.y;
      art.drawBuilding(ctx, b.x, y, b.w, b.h, b.kind, { active: ui.pressedId === b.id });
      // 功能牌和触摸仍由通用UI管理，正式美术可独立替换。
      const labelW = b.key === 'summon' ? 108 : 100;
      const labelX = b.x + (b.w - labelW) / 2;
      ui.panel(labelX, y + b.h - 2, labelW, 37, { fill: '#eee3c8', r: 3 });
      ui.text(b.name, b.x + b.w / 2, y + b.h + 2, { size: 15, bold: true, color: INK, align: 'center' });
      ui.text(b.hint + ' ›', b.x + b.w / 2, y + b.h + 22, { size: 9, color: MUTED, align: 'center' });
      ui.tap(b.x - 3, y, b.w + 6, b.h + 35, () => b.tab ? app.switchTab(b.tab) : app.push(b.page), b.id);
    });
    ui.endScroll();

    // 快捷功能固定在城镇两侧，滑动城镇时仍可直接到达。
    const ready = v.quests.some(q => q.done && !q.claimed) || v.chests.some(c => c.can && !c.claimed);
    this.cityShortcut(10, 111, '令', '每日任务', 'home-link-1', () => { this.refresh(); this.showQuests = true; }, ready);
    this.cityShortcut(309, 111, '囊', '背包', 'home-bag', () => app.switchTab('bag'));
    if (contentH > mapH) {
      ui.panel(136, mapY + mapH - 21, 103, 18, { fill: '#eee3c8', r: 9 });
      ui.text('上下滑动逛主城', 187.5, mapY + mapH - 18, { size: 9, color: MUTED, align: 'center' });
    }
    this.drawCityDock(s, v);
    if (this.showQuests) this.drawQuests();
    if (this.showIdle) this.drawIdle();
  },
  drawCityHeader(s, v) {
    ui.panel(8, 8, 46, 47, { fill: '#56695f', ornate: true, r: 5 });
    ui.text('主', 31, 15, { size: 25, bold: true, color: '#f5e7be', align: 'center' });
    ui.text('挂机定三国', 65, 11, { size: 20, bold: true, color: INK });
    const hasPlayerLevel = typeof store.playerLevel === 'function' && s.player;
    const name = hasPlayerLevel ? '主公 Lv.' + store.playerLevel() : '主公 · 桃园起兵';
    ui.text(name, 65, 36, { size: 11, color: MUTED });
    ui.text('战力 ' + v.myPower, 361, 18, { size: 11, color: INK, align: 'right' });
    if (hasPlayerLevel) {
      const need = store.playerXpNeeded(store.playerLevel());
      const maxed = store.playerLevel() >= C.MAX_LEVEL;
      ui.text(maxed ? '等级已满' : '经验 ' + F.fmtNum(s.player.exp) + '/' + F.fmtNum(need), 361, 38, { size: 9, color: MUTED, align: 'right' });
    }
    [['gold', '铜钱'], ['gem', '元宝'], ['scroll', '招募令'], ['iron', '精铁']].forEach(([key, name], i) => {
      const x = 8 + i * 91;
      ui.panel(x, 64, 84, 25, { fill: '#ddd0b2', r: 5 });
      ui.text(name, x + 8, 71, { size: 10, color: MUTED });
      ui.text(F.fmtNum(s.res[key]), x + 77, 70, { size: 11, bold: true, color: INK, align: 'right' });
    });
  },
  cityShortcut(x, y, glyph, name, id, cb, ready) {
    ui.panel(x, y, 56, 54, { fill: '#e8dcc0', r: 5 });
    ui.text(glyph, x + 28, y + 5, { size: 23, bold: true, color: '#677767', align: 'center' });
    ui.text(name, x + 28, y + 34, { size: 10, color: INK, align: 'center' });
    ui.tap(x, y, 56, 54, cb, id);
    if (ready) ui.tag('可领', x + 19, y - 4, '#9f4f3d');
  },
  drawCityDock(s, v) {
    const y = app.H - 220;
    const idle = this.idle || store.idlePending();
    const hasIdle = !!(idle.gold || idle.exp || idle.scroll || idle.iron);
    const dailyReady = v.quests.some(q => q.done && !q.claimed) || v.chests.some(c => c.can && !c.claimed);
    const canClaim = hasIdle || dailyReady;
    const mins = Math.floor(idle.hours * 60);
    ui.panel(0, y, 375, 168, { fill: PAPER, r: 0 });
    ui.text(v.stageName, 14, y + 7, { size: 13, color: INK, bold: true });
    ui.text('第 ' + v.stageNo + ' 关' + (v.isBoss ? ' · 名将' : ''), 360, y + 9, { size: 10, color: MUTED, align: 'right' });
    const goal = this.goal;
    ui.panel(12, y + 27, 351, 35, { fill: '#ddd0b2', r: 5 });
    ui.text(goal ? goal.title : '继续三国征途', 22, y + 32, { size: 11, color: INK, bold: true });
    ui.btn(279, y + 31, 66, 26, { text: '查看目标 ›', style: 'plain', size: 9, id: 'city-goal', cb: () => this.openGoal(goal) });
    ui.text(this.goalSummary(goal), 22, y + 49, { size: 8, color: MUTED });
    const training = typeof store.settleBattle === 'function' && typeof store.playerLevel === 'function';
    ui.btn(12, y + 67, training ? 253 : 351, 37, { text: '自动出征', sub: '遇阻有限练兵后停止', style: 'red', size: 16, id: 'go-battle', cb: () => app.push('battle', { mode: 'campaign', auto: true }) });
    if (training) ui.btn(273, y + 67, 90, 37, { text: '练兵', sub: '最多10胜', style: 'gold', size: 12, id: 'go-training', cb: () => app.push('battle', { mode: 'training', auto: true }) });
    ui.text('离线收益' + (dailyReady ? ' · 日常可领' : '') , 14, y + 113, { size: 11, color: INK, bold: true });
    ui.text(idle.full ? '已满 · ' + C.IDLE_CAP_HOURS + '小时' : '积累 ' + Math.floor(mins / 60) + '时' + mins % 60 + '分', 14, y + 132, { size: 9, color: MUTED });
    ui.btn(141, y + 111, 128, 34, { text: canClaim ? '一键收获' : '收益积累中', style: 'gold', size: 11, id: 'idle-claim', disabled: !canClaim, cb: () => this.claimFreeRewards() });
    ui.btn(278, y + 111, 85, 34, { text: '加速 / 双倍', style: 'plain', size: 9, id: 'idle-more', cb: () => { this.showIdle = true; } });
  },
  goalSummary(goal) {
    if (!goal) return '';
    const a = goal.action || {}, p = goal.progress || {}, reward = goal.rewardPreview || {};
    if (p.remaining != null) return '进度 ' + p.current + '/' + p.target + ' · 章末宝箱与阶段自选权益';
    if (a.focusFirstWin) return '选择一名初始武将自动升星';
    if (a.id && a.focus === 'ascend') return '重复武将卡会自动升星';
    if (a.boxQ) return '待选军械箱 · 品质 ' + a.boxQ;
    if (a.pickRarity) return '待用 ' + (a.pickRarity === 3 ? 'SR' : 'SSR') + ' 自选券';
    if (a.recommendations) return a.recommendations.length + ' 个部位有免费提升';
    if (reward.replacements) return reward.replacements.length + ' 个部位有免费提升';
    return '点击查看奖励与操作入口';
  }
};
