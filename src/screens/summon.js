// 点将台：招募单抽/十连、元宝十连、保底进度、翻牌揭示
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
  result: null, revealCount: 0, revealTimer: 0, busy: false,

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
    ui.text('点  将  台', cx, y + 14, { size: 22, color: T.GOLD_HI, bold: true, align: 'center' });
    ui.text('聚天下英杰 · 成千秋霸业', cx, y + 42, { size: 10, color: T.DIM, align: 'center' });
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ui.time * 1.2);
    ctx.font = T.font(22);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = T.GOLD;
    ctx.fillText('☯', 0, 0);
    ctx.restore();
    ui.text('概率：SSR 2.5% · SR 12% · ' + C.GACHA.hardPity + ' 抽内含保底', 187, y + 128, { size: 10, color: T.DIM, align: 'center' });
    y += 158;

    // 保底进度
    ui.panel(8, y, 359, 56);
    ui.text('终得保底（' + this.sm.pity + '/' + C.GACHA.hardPity + ' 抽必出 SSR）', 20, y + 8, { size: 10, color: T.DIM });
    ui.bar(20, y + 22, 320, 7, this.sm.pity / C.GACHA.hardPity, 'gold');
    ui.text('心愿将星（' + this.sm.wish + '/' + C.GACHA.wishMax + ' 抽必出 SSR）', 20, y + 33, { size: 10, color: T.DIM });
    ui.bar(20, y + 45, 320, 7, this.sm.wish / C.GACHA.wishMax, 'green');
    y += 64;

    // 招募按钮
    ui.btn(8, y, 110, 46, { text: '招募 ×1', sub: '📜 招募令 ×1', style: 'ghost', size: 14, id: 'pull1', cb: () => this.pull('scroll1') });
    ui.btn(126, y, 113, 46, { text: '招募 ×10', sub: '📜 招募令 ×10', style: 'gold', size: 14, id: 'pull10', cb: () => this.pull('scroll10') });
    ui.btn(247, y, 112, 46, { text: '元宝十连', sub: '💵 2880 · 首十连出SSR', style: 'gold', size: 14, id: 'pullG', cb: () => this.pull('gem10') });
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
  },

  pull(type) {
    if (this.busy) return;
    const r = store.doSummon(type);
    if (!r.ok) { ui.toast(r.msg); return; }
    this.result = r.results.map(x => {
      const def = heroes.getHero(x.id);
      return {
        ...x, name: def.name, surname: def.name.slice(0, 1),
        faction: def.faction, rarity: def.rarity, title: def.title
      };
    });
    this.revealCount = 0;
    this.revealTimer = 0;
    this.busy = true;
    this.refresh();
  },
  drawResult() {
    const list = this.result;
    const ctx = ui.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(8,4,2,0.92)';
    ctx.fillRect(0, 0, app.W, app.H);
    ctx.restore();
    ui.setModalClose(() => {
      if (!this.busy) { this.result = null; this.refresh(); }
    });
    ui.tap(0, 0, app.W, app.H, () => {
      if (!this.busy) { this.result = null; this.refresh(); }
    }, 'summon-mask');
    ui.text('点 将 · ' + list.length + ' 连', 187, 120, { size: 20, color: T.GOLD_HI, bold: true, align: 'center' });
    const cols = list.length > 1 ? 3 : 1;
    const cw = 74, chh = 100, gap = 10;
    const totalW = Math.min(cols, list.length) * (cw + gap) - gap;
    const x0 = (app.W - totalW) / 2;
    const y0 = 165;
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
        if (r.rarity === 3) {
          ctx2.shadowColor = 'rgba(240,185,94,0.9)';
          ctx2.shadowBlur = 14;
          ctx2.stroke();
        }
        ctx2.restore();
        ui.text(r.surname, x + cw / 2, y + 22, { size: 30, bold: true, align: 'center', color: '#fff6e0' });
        ui.text(r.name, x + cw / 2, y + 62, { size: 13, bold: true, align: 'center' });
        ui.text(rar.name, x + cw / 2, y + 78, { size: 12, color: rar.color, bold: true, align: 'center' });
        if (r.isNew) {
          roundRectFill(ui, x + cw - 30, y + 4, 26, 13, 4, 'rgba(192,138,62,0.95)');
          ui.text('NEW', x + cw - 17, y + 6.5, { size: 8, color: '#3a2408', bold: true, align: 'center', baseline: 'top' });
        } else {
          roundRectFill(ui, x + cw - 32, y + 4, 28, 13, 4, 'rgba(0,0,0,0.6)');
          ui.text('+1卡', x + cw - 18, y + 6.5, { size: 8, color: T.DIM, align: 'center', baseline: 'top' });
        }
      }
    });
    ui.btn(137, y0 + Math.ceil(list.length / cols) * (chh + gap) + 16, 100, 32, {
      text: this.busy ? '揭示中…' : '确 定', style: 'gold', size: 14, disabled: this.busy, id: 'summon-ok',
      cb: () => { this.result = null; this.refresh(); }
    });
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
