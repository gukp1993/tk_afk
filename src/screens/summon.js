// 点将台：招募单抽/十连、元宝十连、固定概率公示、翻牌揭示
const { app, ui } = require('../app');
const ads = require('../ads');
const T = require('../theme');
const store = require('../../utils/store');
const heroes = require('../../utils/heroes');
const C = require('../../utils/config');
const F = require('../../utils/fmt');

module.exports = {
  name: 'summon',
  scroll: {}, scrollReg: {},
  result: null, revealCount: 0, revealTimer: 0, busy: false, confirmPull: null,

  onEnter() { this.refresh(); },
  refresh() {
    const s = store.getState();
    this.sm = s.summon;
  },
  update(dt) {
    if (this.result && this.revealCount < this.result.length) {
      this.revealTimer += dt;
      const need = this.result.length > 1 ? 0.16 : 0.4;
      while (this.revealTimer >= need && this.revealCount < this.result.length) {
        this.revealTimer -= need;
        this.revealCount++;
      }
    } else if (this.result) {
      this.busy = false;
    }
  },

  draw() {
    app.resBar(10, ['gem', 'scroll']);
    let y = 40;

    // 主视觉
    ui.panel(8, y, 359, 150, { ornate: true });
    const ctx = ui.ctx;
    const cx = 187, cy = y + 66;
    const pulse = 0.5 + 0.5 * Math.sin(ui.time * 2.4);
    ctx.save();
    ctx.strokeStyle = 'rgba(240,207,138,' + (0.25 + pulse * 0.25) + ')';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 44 + pulse * 4, 0, Math.PI * 2);
    ctx.stroke();
    const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, 70);
    g.addColorStop(0, 'rgba(240,201,100,' + (0.16 + pulse * 0.1) + ')');
    g.addColorStop(1, 'rgba(240,201,100,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, 70, 0, Math.PI * 2); ctx.fill();
    // 旋转光线
    ctx.translate(cx, cy);
    ctx.rotate(ui.time * 0.6);
    ctx.strokeStyle = 'rgba(217,169,78,0.10)';
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath(); ctx.moveTo(0, 20); ctx.lineTo(0, 62); ctx.stroke();
    }
    ctx.restore();
    ui.text('召唤 · 点将台', cx, y + 14, { size: 22, color: T.GOLD_HI, bold: true, align: 'center' });
    ui.text('聚天下英杰 · 成千秋霸业', cx, y + 42, { size: 10, color: T.DIM, align: 'center' });
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ui.time * 1.2);
    ctx.font = T.font(22);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = T.GOLD;
    ctx.fillText('☯', 0, 0);
    ctx.restore();
    ui.text('概率 SSR 2% · SR 10% · R 28% · N 60%', 187, y + 128, { size: 10, color: T.DIM, align: 'center' });
    y += 158;

    // 概率图例（四色稀有度）
    ui.panel(8, y, 359, 56);
    ui.text('武将池 · 120 将 · 固定概率，无保底', 20, y + 8, { size: 10, color: T.DIM });
    const legend = [T.RARITY[4], T.RARITY[3], T.RARITY[2], T.RARITY[1]];
    legend.forEach((r, i) => {
      const lx = 20 + i * 88;
      ctx.fillStyle = r.color;
      ctx.fillRect(lx, y + 24, 10, 10);
      ui.text(r.name, lx + 15, y + 24, { size: 11, color: r.color, bold: true, baseline: 'top' });
    });
    ui.text('SSR 16 · SR 24 · R 43 · N 37', 20, y + 42, { size: 10, color: T.DIM });
    y += 64;

    // 招募按钮
    ui.btn(8, y, 110, 46, { text: '招募 ×1', sub: '📜 招募令 ×1', style: 'ghost', size: 14, id: 'pull1', cb: () => this.pull('scroll1') });
    ui.btn(126, y, 113, 46, { text: '招募 ×10', sub: '📜 招募令 ×10', style: 'gold', size: 14, id: 'pull10', cb: () => this.pull('scroll10') });
    ui.btn(247, y, 112, 46, { text: '元宝十连', sub: '💵 ' + C.GACHA.costTenGold, style: 'gold', size: 14, id: 'pullG', cb: () => this.pull('gem10') });
    y += 54;
    // 看广告免费招募
    const adLeft = ads.remaining('summon');
    ui.btn(8, y, 351, 26, {
      text: '📺 看广告得招募令 ×1（今日 ' + (1 - adLeft) + '/1）', style: 'ghost', size: 11,
      id: 'ad-summon', disabled: adLeft <= 0,
      cb: () => {
        ads.showRewarded('summon', () => {
          store.applyReward({ scroll: 1 });
          ui.toast('广告奖励：招募令 ×1');
          this.refresh();
        }, (msg) => ui.toast(msg));
      }
    });

    // 结果弹层
    if (this.result) this.drawResult();
    if (this.confirmPull) this.drawPullConfirm();
  },

  pull(type) {
    if (this.busy) return;
    this.confirmPull = type;
  },
  cancelPull() { this.confirmPull = null; },
  drawPullConfirm() {
    const type = this.confirmPull;
    const cost = type === 'scroll1' ? { key: 'scroll', amount: 1, label: '招募令' }
      : type === 'scroll10' ? { key: 'scroll', amount: 10, label: '招募令' }
        : { key: 'gem', amount: C.GACHA.costTenGold, label: '元宝' };
    const current = Number(store.getState().res[cost.key]) || 0;
    const after = current - cost.amount;
    const h = 190, y = Math.max(45, (app.H - h) / 2), x = 24, w = app.W - 48;
    ui.setModalClose(() => this.cancelPull());
    ui.modal('确认招募', x, y, w, h);
    ui.tap(x, y, w, h, () => {}, 'summon-confirm-mask');
    ui.text((type === 'scroll1' ? '招募 1 名武将' : '招募 10 名武将'), app.W / 2, y + 48, { size: 16, color: T.GOLD_HI, bold: true, align: 'center' });
    ui.text('消耗 ' + cost.label + ' ×' + F.fmtNum(cost.amount), app.W / 2, y + 78, { size: 13, color: T.TEXT, align: 'center' });
    ui.text(cost.label + '：' + F.fmtNum(current) + ' → ' + F.fmtNum(Math.max(0, after)), app.W / 2, y + 101, { size: 11, color: after >= 0 ? T.DIM : T.RED, align: 'center' });
    ui.btn(x + 18, y + 132, 132, 36, { text: '再想想', style: 'ghost', id: 'summon-confirm-cancel', cb: () => this.cancelPull() });
    ui.btn(x + w - 150, y + 132, 132, 36, { text: '确认招募', style: 'gold', id: 'summon-confirm-yes', disabled: after < 0, cb: () => this.executePull(type) });
  },
  executePull(type) {
    if (!this.confirmPull || this.busy) return;
    this.confirmPull = null;
    const r = store.doSummon(type);
    if (!r.ok) { ui.toast(r.msg); return; }
    const inFormation = store.getState().formation;
    this.result = r.results.map(x => {
      const def = heroes.getHero(x.id);
      return {
        ...x, name: def.name, surname: def.name.slice(0, 1),
        faction: def.faction, rarity: def.rarity, title: def.title,
        inFormation: inFormation.indexOf(x.id) >= 0
      };
    });
    this.scroll.result = 0;
    this.revealCount = 0;
    this.revealTimer = 0;
    this.busy = true;
    this.refresh();
  },
  drawResult() {
    const list = this.result;
    // 结果窗口和底部确认固定在导航栏上方，短屏只滚动卡片。
    const close = () => {
      if (!this.busy) { this.result = null; this.refresh(); }
    };
    ui.setModalClose(close);
    ui.modal('召唤结果 · ' + list.length + ' 名英雄', 8, 24, 359, app.H - 88);
    ui.tap(8, 24, 359, app.H - 88, () => {}, 'summon-result-panel');
    ui.text('新英雄直接入队；抽到重复武将自动升星，无需铜钱', 187, 61, { size: 10, color: T.DIM, align: 'center' });
    const cols = list.length > 1 ? 3 : 1;
    const cw = 90, chh = 106, gap = 10;
    const totalW = Math.min(cols, list.length) * (cw + gap) - gap;
    const x0 = (app.W - totalW) / 2;
    const y0 = 86;
    const contentH = Math.ceil(list.length / cols) * (chh + gap) - gap;
    const viewH = Math.min(contentH, app.H - 216);
    ui.beginScroll(this, 'result', 20, y0, 335, viewH, contentH);
    list.forEach((r, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = x0 + col * (cw + gap);
      const y = y0 + row * (chh + gap);
      const revealed = i < this.revealCount;
      ui.panel(x, y, cw, chh, {});
      if (!revealed) {
        // 卡背
        const ctx2 = ui.ctx;
        ctx2.save();
        const g = ctx2.createLinearGradient(0, y, 0, y + chh);
        g.addColorStop(0, '#3a2b18'); g.addColorStop(1, '#241a10');
        roundRectFill(ui, x + 2, y + 2, cw - 4, chh - 4, 6, g);
        ctx2.strokeStyle = 'rgba(217,169,78,0.2)';
        ctx2.lineWidth = 1;
        for (let d = -chh; d < cw; d += 7) {
          ctx2.beginPath();
          ctx2.moveTo(x + Math.max(0, d), y + Math.max(0, -d));
          ctx2.lineTo(x + Math.min(cw, d + chh), y + Math.min(chh, cw - d + chh > chh ? chh : cw - d + chh));
          ctx2.stroke();
        }
        ctx2.font = T.font(30, true);
        ctx2.fillStyle = 'rgba(240,207,138,0.8)';
        ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
        ctx2.fillText('?', x + cw / 2, y + chh / 2);
        ctx2.restore();
      } else {
        const fac = T.FACTION[r.faction];
        const rar = T.RARITY[r.rarity];
        let ctx2 = ui.ctx;
        ctx2.save();
        const g = ctx2.createLinearGradient(0, y, 0, y + chh);
        g.addColorStop(0, fac.fill);
        g.addColorStop(1, 'rgba(0,0,0,0.4)');
        roundRectFill(ui, x + 2, y + 2, cw - 4, chh - 4, 6, g);
        ctx2.restore();
        ui.panel(x, y, cw, chh, { fill: 'rgba(0,0,0,0)' });
        ctx2 = ui.ctx;
        ctx2.save();
        roundRectPath2(ui, x + 1.5, y + 1.5, cw - 3, chh - 3, 6);
        ctx2.strokeStyle = rar.frame;
        ctx2.lineWidth = 2;
        ctx2.stroke();
        if (r.rarity === 4) {
          ctx2.shadowColor = 'rgba(240,185,94,0.9)';
          ctx2.shadowBlur = 14;
          ctx2.stroke();
        }
        ctx2.restore();
        ui.text(r.surname, x + cw / 2, y + 22, { size: 30, bold: true, align: 'center', color: '#fff6e0' });
        ui.text(r.name, x + cw / 2, y + 62, { size: 13, bold: true, align: 'center' });
        ui.text(rar.name, x + cw / 2, y + 78, { size: 12, color: rar.color, bold: true, align: 'center' });
        if (r.autoStar && r.powerDelta > 0) ui.text((r.inFormation ? '出战战力 +' : '武将战力 +') + F.fmtNum(r.powerDelta), x + cw / 2, y + 93, { size: 8, color: T.GOLD_HI, align: 'center' });
        if (r.isNew) {
          roundRectFill(ui, x + cw - 30, y + 4, 26, 13, 4, 'rgba(192,138,62,0.95)');
          ui.text('NEW', x + cw - 17, y + 6.5, { size: 8, color: '#3a2408', bold: true, align: 'center', baseline: 'top' });
        } else if (r.autoStar) {
          roundRectFill(ui, x + cw - 48, y + 4, 44, 13, 4, 'rgba(192,138,62,0.95)');
          ui.text('★' + r.fromStar + '→' + r.star, x + cw - 26, y + 6.5, { size: 7, color: '#3a2408', bold: true, align: 'center', baseline: 'top' });
        } else {
          roundRectFill(ui, x + cw - 39, y + 4, 35, 13, 4, 'rgba(0,0,0,0.6)');
          ui.text('留存×' + r.cards, x + cw - 21.5, y + 6.5, { size: 7, color: T.DIM, align: 'center', baseline: 'top' });
        }
      }
    });
    ui.endScroll();
    const buttonY = app.H - 106;
    if (contentH > viewH) ui.text('上下滑动查看全部英雄', 187, buttonY - 19, { size: 10, color: T.DIM, align: 'center' });
    if (this.busy) {
      ui.btn(42, buttonY, 132, 34, { text: '立即揭示', style: 'ghost', size: 12, id: 'summon-skip-reveal', cb: () => { this.revealCount = list.length; this.busy = false; } });
      ui.btn(201, buttonY, 132, 34, { text: '揭示中…', style: 'gold', size: 12, disabled: true, id: 'summon-ok' });
    } else {
      const firstNew = list.find(r => r.isNew);
      ui.btn(30, buttonY, 145, 34, { text: firstNew ? '查看新武将' : '完成', style: firstNew ? 'ghost' : 'gold', size: 12, id: 'summon-view-hero', cb: () => {
        this.result = null; this.refresh();
        if (firstNew) app.push('heroDetail', { id: firstNew.id });
      } });
      ui.btn(200, buttonY, 145, 34, { text: '完成', style: 'gold', size: 12, id: 'summon-ok', cb: () => { this.result = null; this.refresh(); } });
    }
  }
};
function roundRectFill(uiIns, x, y, w, h, r, style) {
  const ctx = uiIns.ctx;
  roundRectPath2(uiIns, x, y, w, h, r);
  ctx.fillStyle = style;
  ctx.fill();
}
function roundRectPath2(uiIns, x, y, w, h, r) {
  const ctx = uiIns.ctx;
  r = Math.min(r, w / 2, h / 2);
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
}
