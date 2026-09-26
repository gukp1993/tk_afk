// 战斗场景：引擎步进 + 单元渲染 + 飘字 + 大招横幅 + 结算
const { app, ui } = require('../app');
const ads = require('../ads');
const T = require('../theme');
const store = require('../../utils/store');
const battleMod = require('../../utils/battle');
const stages = require('../../utils/stages');
const heroes = require('../../utils/heroes');
const items = require('../../utils/items');
const C = require('../../utils/config');
const F = require('../../utils/fmt');

// 战场坐标（逻辑 px，设计宽 375）：铺满竖屏
const POS = {
  B3: [128, 130], B4: [248, 130],
  B0: [75, 275], B1: [187, 275], B2: [300, 275],
  A0: [75, 520], A1: [187, 520], A2: [300, 520],
  A3: [128, 665], A4: [248, 665]
};
const CC_ICON = { stun: '✦', freeze: '❄', silence: '🔇' };

module.exports = {
  name: 'battle',
  scroll: {}, scrollReg: {},

  onEnter(params) {
    this.mode = params.mode || 'campaign';
    this.arenaOpt = params.arenaOpt || null;
    this.stage = params.stage;
    this.floor = params.floor;
    this.retryCount = 0;
    this.result = null;
    this.over = false;
    this.start();
  },
  onExit() { store.save(); },

  buildCfg() {
    let team = store.playerUnits();
    if (this.revivePct) team = team.map(u => Object.assign({}, u, { startHpPct: this.revivePct }));
    if (this.mode === 'tower') {
      const def = stages.makeTowerEnemies(this.floor);
      return { title: def.name, team, enemy: store.enemyUnits(def.units), seed: 55000 + this.floor * 77 + this.retryCount };
    }
    if (this.mode === 'arena') {
      const opt = this.arenaOpt;
      const def = stages.makeArenaEnemies(store.teamPower(), opt.seed, opt.diff);
      return { title: '演武场 · 对阵 ' + opt.name, team, enemy: store.enemyUnits(def.units), seed: opt.seed + this.retryCount };
    }
    const stage = this.stage || (store.getState().campaign.cleared + 1);
    this.stage = stage;
    const def = stages.makeStageEnemies(stage);
    return { title: def.name + (def.isBoss ? ' ⚔' : ''), team, enemy: store.enemyUnits(def.units), seed: 1000 + stage * 13 + this.retryCount, story: def.story };
  },
  start(keepRevive) {
    if (!keepRevive) { this.reviveUsed = false; this.revivePct = 0; }
    if (store.playerUnits().length === 0) {
      ui.toast('请先在编队中上阵武将');
      app.pop();
      return;
    }
    this.cfg = this.buildCfg();
    this.engine = battleMod.createBattle({ team: this.cfg.team, enemy: this.cfg.enemy, seed: this.cfg.seed });
    // 剧情弹层：战役模式且该关剧情未看过时插播（打字机 + 点击推进，看过不再弹）
    this.storyPages = []; this.storyPage = 0; this.storyChars = 0; this.storyOpen = false;
    if (this.mode === 'campaign' && this.cfg.story && !store.isStorySeen(this.stage)) {
      const st = this.cfg.story;
      this.storyPages = [{ nar: st.stage.narration }]
        .concat((st.stage.dialogue || []).map(d => ({ who: heroes.getHero(d.who), text: d.text })));
      this.storyOpen = true;
    }
    this.meta = this.cfg.team.concat(this.cfg.enemy).map(u => {
      const h = heroes.getHero(u.heroId);
      const pos = POS[u.uid] || [187, 260];
      return {
        uid: u.uid, side: u.uid.charAt(0), name: u.name,
        surname: (u.name || '?').slice(0, 1), faction: u.faction,
        rarity: h ? h.rarity : 1, isBoss: !!u.isBoss,
        x: pos[0], y: pos[1],
        hp: u.stats.hp, maxHp: u.stats.hp, shield: 0, energy: 0,
        alive: true, cc: null, actAnim: 0, glow: 0
      };
    });
    this.banner = null; this.bannerT = 0;
    this.flashT = 0; this.shakeT = 0;
    this.over = false; this.result = null; this.speed = 1;
    this.timeLeft = 90;
  },

  update(dt) {
    // 剧情弹层期间战斗暂停，只推进打字机
    if (this.storyOpen) { this.storyChars += dt * 24; return; }
    if (this.over || !this.engine) return;
    let events = [], r = null;
    for (let i = 0; i < this.speed; i++) {
      r = this.engine.step(0.1);
      events = events.concat(r.events);
      if (r.done) break;
    }
    this.applyEvents(events);
    // 同步快照
    const snap = {};
    this.engine.snapshot().forEach(s => { snap[s.uid] = s; });
    this.meta.forEach(m => {
      const s = snap[m.uid];
      if (!s) return;
      m.hp = s.hp; m.shield = s.shield; m.energy = s.energy;
      m.alive = s.alive; m.cc = s.cc;
      if (m.actAnim > 0) m.actAnim -= dt;
      if (m.glow > 0) m.glow -= dt;
    });
    if (r) this.timeLeft = Math.max(0, Math.ceil(90 - r.time));
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.banner = null; }
    if (this.flashT > 0) this.flashT -= dt;
    if (this.shakeT > 0) this.shakeT -= dt;
    if (r && r.done) this.finish(r);
  },

  applyEvents(events) {
    const M = {};
    this.meta.forEach(m => { M[m.uid] = m; });
    events.forEach(ev => {
      switch (ev.e) {
        case 'hit': {
          const m = M[ev.uid];
          if (!m) break;
          const dot = (ev.kind || '').indexOf('dot') === 0;
          ui.addFloat(m.x, m.y - 34, (ev.crit ? '暴击 ' : '') + '-' + ev.amount,
            ev.crit ? '#ff5a3c' : (dot ? '#c98af0' : '#ffb84d'), ev.crit ? 17 : 14);
          break;
        }
        case 'heal': { const m = M[ev.uid]; if (m) ui.addFloat(m.x, m.y - 34, '+' + ev.amount, '#7fe0a8', 14); break; }
        case 'shield': { const m = M[ev.uid]; if (m) ui.addFloat(m.x, m.y - 34, '盾+' + ev.amount, '#8ec5f0', 13); break; }
        case 'cheat': { const m = M[ev.uid]; if (m) ui.addFloat(m.x, m.y - 34, '龙胆！免死', '#7fe0a8', 14); break; }
        case 'death': { const m = M[ev.uid]; if (m) ui.addFloat(m.x, m.y - 24, '阵亡', '#a08c6a', 13); break; }
        case 'act': {
          const m = M[ev.src];
          if (m) m.actAnim = 0.32;
          break;
        }
        case 'ult': {
          const m = M[ev.uid];
          if (m) { m.glow = 1.4; this.banner = { who: m.name, skill: ev.skill, side: m.side }; this.bannerT = 1.1; }
          if (ev.scope === 'all') { this.flashT = 0.5; this.shakeT = 0.32; }
          break;
        }
      }
    });
  },
  finish(r) {
    const res = this.engine.result();
    const win = res.winner === 'A';
    const lines = [];
    if (this.mode === 'campaign') {
      if (win) {
        // 首通奖励与推关只在凯旋时结算（战败不再白拿首通）
        const rw = store.winCampaign(this.stage);
        lines.push('首通奖励：元宝 ' + rw.gem);
        lines.push('铜钱 +' + F.fmtNum(rw.gold) + ' · 兵书 +' + F.fmtNum(rw.exp));
        if (rw.chest) lines.push('📦 章末宝箱：元宝 +' + rw.chest.gem + ' · 招募令 +' + rw.chest.scroll);
        if (rw.scroll) lines.push('招募令 ×' + rw.scroll);
        if (rw.equip) lines.push('获得 [' + items.EQUIP_QUALITIES[rw.equip.q].name + '] ' + items.EQUIP_SLOTS[rw.equip.slot].name + (rw.equip.faction ? '（' + C.FACTIONS[rw.equip.faction].name + '属）' : ''));
        if (this.cfg.story && this.cfg.story.isBoss) lines.push('「' + this.cfg.story.ch.finale + '」');
      } else {
        lines.push('首通奖励需凯旋后方可领取');
      }
    } else if (this.mode === 'tower') {
      const rw = store.winTower(this.floor);
      if (rw.gem) {
        lines.push('首通奖励：元宝 ' + rw.gem);
        if (rw.scroll) lines.push('招募令 ×' + rw.scroll);
        if (rw.shard) lines.push('英雄碎片 ×' + rw.shard);
      } else lines.push('已通关过此层，无首通奖励');
    } else {
      const rw = store.arenaFight(win, this.arenaOpt.diff);
      lines.push('演武积分 ' + (rw.delta >= 0 ? '+' : '') + rw.delta + '（当前 ' + rw.points + ' · ' + items.arenaRank(rw.points) + '）');
      lines.push('获得演武令 ×' + rw.tokens);
    }
    lines.push('用时 ' + res.duration + ' 秒');
    let nextLabel = '';
    if (win) {
      if (this.mode === 'campaign') nextLabel = '进军下一关';
      if (this.mode === 'tower') nextLabel = '挑战下一层';
    }
    store.save();
    this.over = true;
    this.result = { win, lines, nextLabel };
  },

  draw() {
    // 剧情弹层独占画面（战斗已暂停）
    if (this.storyOpen) { this.drawStory(); return; }
    const ctx = ui.ctx;
    let shakeX = 0, shakeY = 0;
    if (this.shakeT > 0) {
      shakeX = Math.sin(this.shakeT * 60) * 4;
      shakeY = Math.cos(this.shakeT * 47) * 3;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 顶栏
    ui.text(this.cfg.title, 12, 10, { size: 13, color: T.GOLD });
    ui.text('⏳ ' + this.timeLeft + 's', 363, 10, { size: 12, color: this.timeLeft < 15 ? T.RED_HI : T.DIM, align: 'right' });

    // 中线
    ctx.save();
    ctx.strokeStyle = 'rgba(217,169,78,0.35)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(24, 398); ctx.lineTo(351, 398);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = T.BG;
    ctx.fillRect(160, 390, 56, 15);
    ctx.restore();
    ui.text('对 阵', 187, 392, { size: 10, color: 'rgba(217,169,78,0.55)', align: 'center' });

    // 单元
    this.meta.forEach(m => this.drawUnit(m));

    // 全屏闪光
    if (this.flashT > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.flashT / 0.5) * 0.55;
      const g = ctx.createRadialGradient(187, 398, 30, 187, 398, 300);
      g.addColorStop(0, 'rgba(255,220,150,0.8)');
      g.addColorStop(1, 'rgba(255,120,60,0.2)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, app.W, app.H);
      ctx.restore();
    }
    ctx.restore(); // shake

    // 大招横幅
    if (this.banner) {
      const p = this.bannerT / 1.1;
      ctx.save();
      ctx.globalAlpha = p > 0.85 ? (1 - p) / 0.15 : (p < 0.2 ? p / 0.2 : 1);
      ctx.fillStyle = 'rgba(20,12,5,0.92)';
      ctx.fillRect(0, 374, app.W, 42);
      ctx.fillStyle = 'rgba(240,207,138,0.7)';
      ctx.fillRect(0, 374, app.W, 1);
      ctx.fillRect(0, 415, app.W, 1);
      ui.text(this.banner.who, 187, 378, { size: 10, color: this.banner.side === 'A' ? '#8fd8ae' : '#e89078', align: 'center' });
      ctx.font = T.font(19, true);
      ctx.fillStyle = T.GOLD_HI;
      ctx.shadowColor = 'rgba(240,207,138,0.65)';
      ctx.shadowBlur = 12;
      ctx.textAlign = 'center';
      ctx.fillText(this.banner.skill, 187, 400);
      ctx.restore();
    }

    // 底部控制
    if (this.over && this.result) {
      this.drawResult();
      return;
    }
    ui.btn(12, app.H - 42, 70, 30, { text: '撤退', style: 'ghost', size: 13, id: 'retreat', cb: () => app.pop() });
    ui.btn(90, app.H - 42, 90, 30, { text: '加速 ×' + this.speed, style: 'ghost', size: 13, id: 'speed', cb: () => { this.speed = this.speed >= 4 ? 1 : this.speed * 2; } });
    ui.btn(188, app.H - 42, 100, 30, { text: '跳过战斗', style: 'gold', size: 13, id: 'skip', cb: () => this.skip() });
  },
  drawResult() {
    const ctx = ui.ctx;
    const r = this.result;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(0, 0, app.W, app.H);
    ctx.restore();
    const bx = 40, bw = 295, by = 210, bh = 260;
    ui.panel(bx, by, bw, bh, { ornate: true });
    ui.text(r.win ? '凯  旋' : '败  北', 187, by + 22, {
      size: 30, bold: true, align: 'center',
      color: r.win ? T.GOLD_HI : '#8a7a62'
    });
    let y = by + 66;
    r.lines.forEach(line => {
      ui.text(line, 187, y, { size: 11, align: 'center' });
      y += 17;
    });
    const canRevive = !r.win && !this.reviveUsed && ads.remaining('revive') > 0;
    const reviveLeft = C.AD.placements.revive.limit - store.adCount('revive');
    // 行1：返回 / 再战
    ui.btn(bx + 14, by + bh - 84, 128, 30, { text: '返回', style: 'ghost', size: 13, id: 'res-exit', cb: () => app.pop() });
    ui.btn(bx + 153, by + bh - 84, 128, 30, { text: '再战', style: 'ghost', size: 13, id: 'res-retry', cb: () => { this.retryCount++; this.over = false; this.result = null; this.start(); } });
    // 行2：复活（仅败北且可用时）/ 下一关
    if (canRevive) {
      ui.btn(bx + 14, by + bh - 46, 128, 30, {
        text: '📺 复活再战（' + (1 - reviveLeft) + '/1）', style: 'gold', size: 11, id: 'res-revive',
        cb: () => {
          ads.showRewarded('revive', () => {
            this.reviveUsed = true;
            this.revivePct = 0.3; // 复活后全队以 30% 血量再战
            this.over = false;
            this.result = null;
            this.start(true);
          }, (msg) => ui.toast(msg));
        }
      });
    } else {
      ui.btn(bx + 14, by + bh - 46, 128, 30, {
        text: r.win ? '—' : '复活已用完', style: 'plain', size: 11, disabled: true, id: 'res-revive-off'
      });
    }
    ui.btn(bx + 153, by + bh - 46, 128, 30, {
      text: r.nextLabel || '已至尽头', style: 'gold', size: 12, disabled: !r.nextLabel, id: 'res-next',
      cb: () => {
        if (!r.nextLabel) return;
        if (this.mode === 'campaign') this.stage++;
        if (this.mode === 'tower') this.floor++;
        this.over = false; this.result = null; this.start();
      }
    });
  },
  drawUnit(m) {
    const ctx = ui.ctx;
    const S = 44;
    const jump = m.actAnim > 0 ? (m.side === 'A' ? -7 : 7) * Math.sin((0.32 - m.actAnim) / 0.32 * Math.PI) : 0;
    const x = m.x - S / 2, y = m.y - S / 2 + jump;
    ctx.save();
    if (!m.alive) ctx.globalAlpha = 0.22;
    // 脸谱
    ui.heroFace(x, y, S, m, m.isBoss ? { mark: '👑' } : {});
    // 怒气满发光
    if (m.glow > 0 && m.alive) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, m.glow) * (0.5 + 0.4 * Math.sin(ui.time * 14));
      ctx.strokeStyle = '#f0cf8a';
      ctx.lineWidth = 2.5;
      ui.roundRectPath ? null : null;
      roundedStroke(ctx, x - 2, y - 2, S + 4, S + 4, 9);
      ctx.restore();
    }
    // 状态
    if (m.cc && m.alive) {
      ui.text(CC_ICON[m.cc] || '✦', x + S + 2, y - 6, { size: 12, color: '#f0c964' });
    }
    // 血条
    ui.bar(x - 4, y + S + 3, S + 8, 6, m.maxHp > 0 ? m.hp / m.maxHp : 0, m.side === 'A' ? 'green' : 'red');
    // 护盾条（叠在血条上方细线）
    if (m.shield > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(142,197,240,0.85)';
      const sw = Math.min(1, m.shield / m.maxHp) * (S + 8);
      ctx.fillRect(x - 4, y + S + 1, sw, 1.6);
      ctx.restore();
    }
    // 怒气条
    ui.bar(x - 4, y + S + 11, S + 8, 4, m.energy / 100, 'gold');
    // 名字
    ui.text(m.name, m.x, y + S + 17, { size: 10, color: m.side === 'A' ? '#cdb27f' : T.DIM, align: 'center' });
    ctx.restore();
  },
  skip() {
    if (!this.engine || this.engine.ended) return;
    let guard = 0;
    let r = null;
    while (!this.engine.ended && guard++ < 4000) r = this.engine.step(0.25);
    const snap = {};
    this.engine.snapshot().forEach(s => { snap[s.uid] = s; });
    this.meta.forEach(m => {
      const s = snap[m.uid];
      if (!s) return;
      m.hp = s.hp; m.alive = s.alive; m.shield = s.shield; m.energy = s.energy; m.cc = s.cc;
    });
    this.timeLeft = Math.max(0, Math.ceil(90 - (r ? r.time : 0)));
    this.finish(this.engine.result());
  },

  // ---------- 剧情弹层 ----------
  // 点击推进：未放完的句子先放完，放完则翻页；末页关闭并记入存档（看过不再弹）
  advanceStory() {
    const p = this.storyPages[this.storyPage];
    if (!p) { this.closeStory(); return; }
    const total = ('' + (p.who ? p.text : p.nar)).length;
    if (this.storyChars < total) { this.storyChars = total; return; }
    this.storyPage += 1;
    this.storyChars = 0;
    if (this.storyPage >= this.storyPages.length) this.closeStory();
  },
  closeStory() {
    if (!this.storyOpen) return;
    this.storyOpen = false;
    store.markStorySeen(this.stage);
  },
  drawStory() {
    const ctx = ui.ctx;
    const st = this.cfg.story;
    ctx.save();
    ctx.fillStyle = 'rgba(10,6,2,0.92)';
    ctx.fillRect(0, 0, app.W, app.H);
    ctx.strokeStyle = 'rgba(217,169,78,0.5)';
    ctx.beginPath();
    ctx.moveTo(24, 92); ctx.lineTo(351, 92);
    ctx.stroke();
    ctx.restore();
    ui.text('第' + F.cnNum(st.chIdx + 1) + '章 · ' + st.ch.name, 187, 46, { size: 12, color: T.GOLD, align: 'center' });
    ui.text(st.stage.name, 187, 62, { size: 20, color: T.GOLD_HI, bold: true, align: 'center' });
    ui.text(st.isBoss ? '名 将 关' : '第' + (st.inCh + 1) + '关', 187, 98, { size: 10, color: T.DIM, align: 'center' });

    const p = this.storyPages[this.storyPage];
    const full = ('' + (p.who ? p.text : p.nar));
    const shown = full.slice(0, Math.floor(this.storyChars));
    const isDialog = !!p.who;
    const by = isDialog ? 468 : 560;
    ui.panel(24, by, 327, isDialog ? 220 : 160, { ornate: true });
    if (isDialog) {
      ui.heroFace(40, by - 30, 62, p.who, p.who.rarity === 4 ? { mark: '👑' } : {});
      ui.text(p.who.name, 118, by + 12, { size: 15, color: T.GOLD_HI, bold: true });
      ui.text('·' + C.FACTIONS[p.who.faction].name + '·', 170, by + 15, { size: 10, color: C.FACTIONS[p.who.faction].color });
      ui.wrap(shown, 40, by + 44, 295, 21, { size: 13, color: T.TEXT });
      if (this.storyChars >= full.length) ui.text('▼ 点击继续', 187, by + 192, { size: 10, color: T.DIM, align: 'center' });
    } else {
      ui.wrap(shown, 42, by + 26, 291, 22, { size: 13, color: T.TEXT });
      if (this.storyChars >= full.length) ui.text('▼ 点击继续', 187, by + 130, { size: 10, color: T.DIM, align: 'center' });
    }
    // 全屏点击推进；跳过按钮后注册优先生效
    ui.tap(0, 0, app.W, app.H, () => this.advanceStory(), 'story-page');
    ui.btn(275, 40, 76, 26, { text: '跳过剧情', style: 'ghost', size: 11, id: 'story-skip', cb: () => this.closeStory() });
  }
};
function roundedStroke(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - r);
  ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  ctx.closePath();
  ctx.stroke();
}
