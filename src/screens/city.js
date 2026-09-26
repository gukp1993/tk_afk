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
    [['gold', '铜钱'], ['gem', '元宝'], ['scroll', '招募令']].forEach(([key, name], i) => {
      const x = 8 + i * 122;
      ui.panel(x, 64, 115, 25, { fill: '#ddd0b2', r: 5 });
      ui.text(name, x + 8, 71, { size: 10, color: MUTED });
      ui.text(F.fmtNum(s.res[key]), x + 107, 70, { size: 12, bold: true, color: INK, align: 'right' });
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
    const y = app.H - 184;
    const idle = this.idle || store.idlePending();
    const hasIdle = !!(idle.gold || idle.exp || idle.scroll || idle.iron);
    const mins = Math.floor(idle.hours * 60);
    ui.panel(0, y, 375, 132, { fill: PAPER, r: 0 });
    ui.text(v.stageName, 14, y + 9, { size: 14, color: INK, bold: true });
    ui.text('第 ' + v.stageNo + ' 关' + (v.isBoss ? ' · 名将' : ''), 360, y + 11, { size: 10, color: MUTED, align: 'right' });
    const training = typeof store.settleBattle === 'function' && typeof store.playerLevel === 'function';
    ui.btn(12, y + 32, training ? 253 : 351, 40, { text: '出 征', style: 'red', size: 18, id: 'go-battle', cb: () => app.push('battle', { mode: 'campaign' }) });
    if (training) ui.btn(273, y + 32, 90, 40, { text: '练兵', style: 'gold', size: 14, id: 'go-training', cb: () => app.push('battle', { mode: 'training' }) });
    ui.text('挂机宝箱', 14, y + 83, { size: 13, color: INK, bold: true });
    ui.text(idle.full ? '已满 · 及时领取' : '已积累 ' + Math.floor(mins / 60) + '时' + mins % 60 + '分', 14, y + 103, { size: 10, color: MUTED });
    ui.btn(146, y + 86, 127, 34, { text: hasIdle ? '领取 · 精铁 ' + idle.iron : '收益积累中', style: 'gold', size: 10, id: 'idle-claim', disabled: !hasIdle, cb: () => this.claimIdle(false) });
    ui.btn(281, y + 86, 82, 34, { text: '加速 / 双倍', style: 'plain', size: 10, id: 'idle-more', cb: () => { this.showIdle = true; } });
  }
};
