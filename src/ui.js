// 轻量 Canvas UI 框架（IMGUI 风格：每帧重绘 + 命中区注册）
const T = require('./theme');

function roundRectPath(ctx, x, y, w, h, r) {
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

const ui = {
  ctx: null, W: 375, H: 812,
  hitAreas: [],      // {x,y,w,h,cb,id} 每帧由绘制顺序注册
  dragAreas: [],     // 滚动区域 {x,y,w,h,key,scene}
  pressedId: null,
  touch: null,       // 当前触摸 {sx,sy,x,y,moved,dragKey}
  floaters: [],
  toastMsg: null, toastUntil: 0,
  time: 0,
  touchGeneration: 0,

  begin(ctx, W, H, dt) {
    this.ctx = ctx; this.W = W; this.H = H;
    this.hitAreas = []; this.dragAreas = [];
    this.scrollState = null;
    this.modalActive = false;
    this._modalClose = null;
    this.time += dt;
  },

  // ---------- 触摸（由 app 层喂入） ----------
  onTouchStart(x, y) {
    this.touch = { sx: x, sy: y, x, y, moved: false, dragKey: null, dragScene: null, generation: this.touchGeneration };
    // 命中滚动区域（后注册者优先）
    for (let i = this.dragAreas.length - 1; i >= 0; i--) {
      const d = this.dragAreas[i];
      if (x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) {
        this.touch.dragKey = d.key; this.touch.dragScene = d.scene;
        this.touch.startScroll = d.scene.scroll[d.key] || 0;
        break;
      }
    }
    // 按钮按下态
    const hit = this.hitAt(x, y);
    if (hit) this.pressedId = hit.id;
  },
  onTouchMove(x, y) {
    if (!this.touch) return;
    this.touch.x = x; this.touch.y = y;
    this._updateTouchScroll(this.touch, x, y);
  },
  _updateTouchScroll(touch, x, y) {
    if (Math.abs(x - touch.sx) > 6 || Math.abs(y - touch.sy) > 6) touch.moved = true;
    if (!touch.dragKey || !touch.moved) return;
    const scene = touch.dragScene;
    const reg = scene.scrollReg[touch.dragKey] || {};
    const max = Math.max(0, (reg.contentH || 0) - (reg.viewH || 0));
    const offset = touch.startScroll - (y - touch.sy);
    scene.scroll[touch.dragKey] = Math.max(0, Math.min(max, offset));
  },
  onTouchEnd(x, y) {
    if (!this.touch) return;
    const t = this.touch;
    // Some runtimes coalesce a fast swipe into start/end events without a move event.
    // Apply the final displacement here as well so scrolling never depends on move cadence.
    this._updateTouchScroll(t, x, y);
    this.touch = null;
    const wasPressed = this.pressedId; this.pressedId = null;
    if (!t.moved && t.generation === this.touchGeneration) {
      const hit = this.hitAt(x, y);
      if (hit && hit.id === wasPressed && hit.cb) hit.cb();
    }
  },
  invalidateTouches() {
    this.touchGeneration++;
    this.touch = null;
    this.pressedId = null;
  },
  hitAt(x, y) {
    for (let i = this.hitAreas.length - 1; i >= 0; i--) {
      const a = this.hitAreas[i];
      if (!a.cb) continue;
      if (x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) return a;
    }
    return null;
  },

  tap(x, y, w, h, cb, id) {
    const st = this.scrollState;
    if (st) {
      y -= st.off;
      const right = Math.min(x + w, st.x + st.w);
      const bottom = Math.min(y + h, st.y + st.h);
      x = Math.max(x, st.x); y = Math.max(y, st.y);
      w = right - x; h = bottom - y;
      if (w <= 0 || h <= 0) return;
    }
    this.hitAreas.push({ x, y, w, h, cb, id: id || ('z' + this.hitAreas.length) });
  },

  // ---------- 基础绘制 ----------
  panel(x, y, w, h, opts) {
    const ctx = this.ctx;
    opts = opts || {};
    ctx.save();
    roundRectPath(ctx, x, y, w, h, opts.r === undefined ? 8 : opts.r);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, T.PANEL_HI); g.addColorStop(1, T.PANEL_LO);
    ctx.fillStyle = opts.fill || g;
    ctx.fill();
    ctx.strokeStyle = opts.ornate ? T.LINE_HI : T.LINE;
    ctx.lineWidth = 1;
    ctx.stroke();
    if (opts.ornate) {
      roundRectPath(ctx, x + 2, y + 2, w - 4, h - 4, (opts.r || 8) - 1);
      ctx.strokeStyle = 'rgba(138,106,51,0.25)';
      ctx.stroke();
    }
    ctx.restore();
  },
  text(str, x, y, opts) {
    if (str === undefined || str === null) return 0;
    const ctx = this.ctx;
    opts = opts || {};
    const size = opts.size || 14;
    ctx.save();
    ctx.font = T.font(size, opts.bold);
    ctx.fillStyle = opts.color || T.TEXT;
    ctx.textBaseline = opts.baseline || 'top';
    ctx.textAlign = opts.align || 'left';
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    ctx.fillText('' + str, x, y);
    ctx.restore();
    return this.textWidth(str, size, opts.bold);
  },
  textWidth(str, size, bold) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = T.font(size || 14, bold);
    const w = ctx.measureText('' + str).width;
    ctx.restore();
    return w;
  },
  wrap(str, x, y, maxW, lineH, opts) {
    const ctx = this.ctx;
    opts = opts || {};
    const size = opts.size || 13;
    ctx.save();
    ctx.font = T.font(size, opts.bold);
    ctx.fillStyle = opts.color || T.DIM;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    let line = '', yy = y;
    // ASCII 词（数字/英文/百分号）不拆行：断行点落在词中间时整词移到下一行
    const asciiRun = s => (s.match(/[A-Za-z0-9%.+]+$/) || [''])[0];
    for (const ch of ('' + str)) {
      if (ctx.measureText(line + ch).width > maxW && line) {
        const run = asciiRun(line);
        if (run.length > 1 && run.length < line.length) {
          ctx.fillText(line.slice(0, line.length - run.length), x, yy);
          line = run + ch;
        } else {
          ctx.fillText(line, x, yy);
          line = ch;
        }
        yy += lineH;
      } else line += ch;
    }
    if (line) { ctx.fillText(line, x, yy); yy += lineH; }
    ctx.restore();
    return yy - y;
  },
  bar(x, y, w, h, pct, style) {
    const ctx = this.ctx;
    pct = Math.max(0, Math.min(1, pct || 0));
    ctx.save();
    roundRectPath(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,69,42,0.8)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (pct > 0.01) {
      const colors = {
        gold: ['#b8842e', '#f0cf8a'], green: ['#3f9e5f', '#7fd0a8'],
        red: ['#a33420', '#e86a4a'], blue: ['#3b6ea5', '#7fb0e8']
      }[style || 'green'] || ['#3f9e5f', '#7fd0a8'];
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, colors[0]); g.addColorStop(1, colors[1]);
      roundRectPath(ctx, x + 1, y + 1, Math.max(h - 2, (w - 2) * pct), h - 2, (h - 2) / 2);
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.restore();
  },

  // ---------- 按钮 ----------
  BTN_STYLE: {
    jade: { g: ['#54877a', '#2e6258'], border: '#cbd9a0', color: '#fff3cf' },
    gold: { g: ['#f0cd7c', '#c08a3e'], border: '#f4dd9e', color: '#3a2408' },
    red: { g: ['#d4553a', '#96291a'], border: '#e88a6a', color: '#ffe8d8' },
    ghost: { g: ['rgba(217,169,78,0.08)', 'rgba(217,169,78,0.04)'], border: T.LINE_HI, color: T.GOLD },
    plain: { g: ['#3a2b18', '#2b1f11'], border: T.LINE_HI, color: T.TEXT }
  },
  btn(x, y, w, h, opts) {
    const ctx = this.ctx;
    const st = this.BTN_STYLE[opts.style || 'plain'];
    const disabled = !!opts.disabled;
    this.tap(x, y, w, h, disabled ? null : opts.cb, opts.id);
    const pressed = !disabled && this.pressedId === opts.id;
    ctx.save();
    if (disabled) ctx.globalAlpha = 0.45;
    roundRectPath(ctx, x, y, w, h, opts.r === undefined ? 6 : opts.r);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, st.g[0]); g.addColorStop(1, st.g[1]);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = st.border; ctx.lineWidth = 1; ctx.stroke();
    if (pressed) { ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill(); }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = x + w / 2;
    if (opts.sub) {
      ctx.font = T.font(opts.size || 15, true);
      ctx.fillStyle = st.color;
      ctx.fillText(opts.text, cx, y + h / 2 - 7);
      ctx.font = T.font(9, false);
      ctx.fillStyle = opts.subColor || (st.color === '#3a2408' ? 'rgba(58,36,8,0.75)' : T.DIM);
      ctx.fillText(opts.sub, cx, y + h / 2 + 9);
    } else {
      ctx.font = T.font(opts.size || 14, opts.style === 'gold' || opts.style === 'red');
      ctx.fillStyle = st.color;
      ctx.fillText(opts.text, cx, y + h / 2 + 0.5);
    }
    ctx.restore();
  },
  chipBtn(x, y, w, h, text, active, cb, id) {
    const ctx = this.ctx;
    this.tap(x, y, w, h, cb, id);
    ctx.save();
    roundRectPath(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = active ? 'rgba(217,169,78,0.16)' : 'rgba(0,0,0,0.3)';
    ctx.fill();
    ctx.strokeStyle = active ? T.GOLD : T.LINE;
    ctx.stroke();
    ctx.font = T.font(11, active);
    ctx.fillStyle = active ? T.GOLD_HI : T.DIM;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2 + 0.5);
    ctx.restore();
  },

  tag(text, x, y, color) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = T.font(9);
    const w = this.textWidth(text, 9) + 10;
    roundRectPath(ctx, x, y, w, 14, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();
    ctx.strokeStyle = color || T.LINE;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = color || T.TEXT;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(text, x + w / 2, y + 7.5);
    ctx.restore();
    return w;
  },

  // ---------- 武将脸谱 ----------
  heroFace(x, y, size, calc, opts) {
    const ctx = this.ctx;
    opts = opts || {};
    const fac = T.FACTION[calc.faction] || {};
    const rar = T.RARITY[calc.rarity] || {};
    ctx.save();
    roundRectPath(ctx, x, y, size, size, size * 0.16);
    const g = ctx.createLinearGradient(0, y, 0, y + size);
    g.addColorStop(0, 'rgba(255,255,255,0.10)');
    g.addColorStop(0.25, fac.fill || 'rgba(120,90,60,0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = g; ctx.fill();
    // 斜纹
    ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 3;
    for (let i = -size; i < size * 2; i += 8) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + size);
      ctx.lineTo(x + i + size, y);
      ctx.stroke();
    }
    ctx.restore();
    roundRectPath(ctx, x + 1, y + 1, size - 2, size - 2, size * 0.16);
    ctx.strokeStyle = rar.frame || T.LINE;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.save();
    ctx.font = T.font(size * 0.52, true);
    ctx.fillStyle = 'rgba(255,246,224,0.96)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
    ctx.fillText(calc.surname || (calc.name || '?').slice(0, 1), x + size / 2, y + size / 2 + 1);
    ctx.restore();
    if (opts.mark) {
      ctx.save();
      ctx.font = T.font(8);
      const w = this.textWidth(opts.mark, 8) + 8;
      roundRectPath(ctx, x + size - w - 2, y + 3, w, 12, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
      ctx.strokeStyle = T.LINE_HI; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = T.GOLD_HI;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(opts.mark, x + size - w / 2 - 2, y + 9.5);
      ctx.restore();
    }
  },
  stars(x, y, maxStar, star, size) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = T.font(size || 10);
    ctx.textBaseline = 'top';
    for (let i = 1; i <= 5; i++) {
      if (i <= star) ctx.fillStyle = '#f0c964';
      else if (i <= maxStar) ctx.fillStyle = 'rgba(200,170,110,0.35)';
      else ctx.fillStyle = 'rgba(120,100,70,0.35)';
      ctx.fillText('★', x + (i - 1) * (size || 10) * 1.05, y);
    }
    ctx.restore();
  },
  classNameOf(cls) {
    return { warrior: '武将', tank: '猛将', mage: '军师', archer: '神射', support: '辅助' }[cls] || cls;
  },
  classIconOf(cls) {
    return { warrior: '⚔', tank: '🛡', mage: '✦', archer: '🏹', support: '☯' }[cls] || '';
  },

  // ---------- 滚动区域 ----------
  beginScroll(scene, key, x, y, w, h, contentH) {
    const ctx = this.ctx;
    scene.scroll = scene.scroll || {};
    scene.scrollReg = scene.scrollReg || {};
    scene.scrollReg[key] = { contentH, viewH: h };
    const off = Math.max(0, Math.min(scene.scroll[key] || 0, Math.max(0, contentH - h)));
    scene.scroll[key] = off;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.translate(0, -off);
    this.dragAreas.push({ x, y, w, h, key, scene });
    this.scrollState = { key, x, y, w, h, contentH, off, scene };
    return off;
  },
  endScroll() {
    const st = this.scrollState;
    if (!st) return;
    const ctx = this.ctx;
    ctx.restore();
    // 滚动条
    const max = Math.max(1, st.contentH - st.h);
    const off = st.scene.scroll[st.key] || 0;
    if (st.contentH > st.h) {
      const bh = Math.max(20, st.h * st.h / st.contentH);
      const by = st.y + (st.h - bh) * (off / max);
      const ctx2 = this.ctx;
      ctx2.save();
      roundRectPath(ctx2, st.x + st.w - 3, by, 3, bh, 1.5);
      ctx2.fillStyle = 'rgba(217,169,78,0.35)';
      ctx2.fill();
      ctx2.restore();
    }
    this.scrollState = null;
  },

  // ---------- 弹窗 ----------
  // 返回内容区 {x,y,w,h}；点击遮罩关闭
  modal(title, x, y, w, h, closable) {
    const ctx = this.ctx;
    this.modalActive = true;
    this.hitAreas = [];
    this.dragAreas = [];
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.restore();
    // 兼容场景在 modal() 前后注册关闭回调；点击时读取本帧回调。
    this.tap(0, 0, this.W, this.H, () => {
      if (closable !== false && this._modalClose) this._modalClose();
    }, 'mask-' + title);
    this.panel(x, y, w, h, { ornate: true, r: 10 });
    this.tap(x, y, w, h, () => {}, 'modal-body-' + title);
    if (title) {
      this.text(title, x + w / 2, y + 14, { size: 16, color: T.GOLD_HI, bold: true, align: 'center' });
      // 标题两侧装饰线
      ctx.save();
      ctx.strokeStyle = 'rgba(217,169,78,0.4)';
      ctx.beginPath();
      ctx.moveTo(x + 20, y + 24); ctx.lineTo(x + w / 2 - this.textWidth(title, 16, true) / 2 - 12, y + 24);
      ctx.moveTo(x + w / 2 + this.textWidth(title, 16, true) / 2 + 12, y + 24); ctx.lineTo(x + w - 20, y + 24);
      ctx.stroke();
      ctx.restore();
    }
    return { x: x + 12, y: y + (title ? 38 : 14), w: w - 24, h: h - (title ? 50 : 28) };
  },
  setModalClose(cb) { this._modalClose = cb; },

  // ---------- 飘字 ----------
  addFloat(x, y, text, color, size) {
    this.floaters.push({ x, y, text, color: color || '#ffb84d', size: size || 15, t: 0 });
    if (this.floaters.length > 30) this.floaters.shift();
  },
  drawFloaters(dt) {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of this.floaters) {
      f.t += dt;
      const p = f.t / 0.9;
      if (p >= 1) continue;
      ctx.globalAlpha = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
      ctx.font = T.font(f.size, true);
      ctx.fillStyle = f.color;
      ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 3;
      ctx.fillText(f.text, f.x, f.y - p * 45);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
    this.floaters = this.floaters.filter(f => f.t < 0.9);
  },

  // ---------- toast ----------
  toast(msg) {
    this.toastMsg = msg;
    this.toastUntil = this.time + 1.8;
  },
  drawToast() {
    if (!this.toastMsg || this.time > this.toastUntil) { this.toastMsg = null; return; }
    const ctx = this.ctx;
    const w = this.textWidth(this.toastMsg, 12) + 28;
    const x = (this.W - w) / 2, y = this.H - 140;
    ctx.save();
    ctx.globalAlpha = 0.92;
    roundRectPath(ctx, x, y, w, 30, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fill();
    ctx.strokeStyle = T.LINE_HI; ctx.stroke();
    ctx.fillStyle = T.GOLD_HI;
    ctx.font = T.font(12);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(this.toastMsg, this.W / 2, y + 15.5);
    ctx.restore();
  }
};
module.exports = { ui, roundRectPath };
