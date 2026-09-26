// 游戏核心：画布、主循环、触摸、场景导航、底部导航
const { ui } = require('./ui');
const T = require('./theme');
const store = require('../utils/store');
const ads = require('./ads');
const platform = require('../utils/platform');
const api = platform.api; // wx（微信）/ tt（抖音）平台 API，经适配层获取

const app = {
  canvas: null, ctx: null,
  scale: 1, W: 375, H: 812,
  scenes: {},            // name -> scene 对象
  stack: [],             // 导航栈（push/pop）
  tab: 'home',
  TABS: [
    { key: 'home', icon: '🏯', text: '主城' },
    { key: 'heroes', icon: '⚔', text: '群英' },
    { key: 'summon', icon: '📜', text: '点将' },
    { key: 'journey', icon: '🏛', text: '王庭' }
  ],
  last: 0,

  init() {
    const canvas = api.createCanvas();
    this.canvas = canvas;
    const info = api.getWindowInfo ? api.getWindowInfo() : api.getSystemInfoSync();
    const dpr = Math.min(2, info.pixelRatio || 2);
    const sw = info.screenWidth, sh = info.screenHeight;
    canvas.width = sw * dpr;
    canvas.height = sh * dpr;
    this.scale = sw / 375;
    this.W = 375;
    this.H = Math.round(sh / this.scale);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr * this.scale, dpr * this.scale);
    this.ctx = ctx;

    store.load();
    store.checkDailyReset();

    // 触摸（逻辑坐标）
    const toLogic = (t) => ({ x: t.clientX / this.scale, y: t.clientY / this.scale });
    api.onTouchStart((e) => { const p = toLogic(e.touches[0]); ui.onTouchStart(p.x, p.y); });
    api.onTouchMove((e) => { const p = toLogic(e.touches[0]); ui.onTouchMove(p.x, p.y); });
    api.onTouchEnd((e) => {
      if (e.changedTouches && e.changedTouches[0]) {
        const p = toLogic(e.changedTouches[0]);
        ui.onTouchEnd(p.x, p.y);
      } else ui.onTouchEnd(ui.touch ? ui.touch.x : 0, ui.touch ? ui.touch.y : 0);
    });
    api.onTouchCancel && api.onTouchCancel(() => { ui.touch = null; ui.pressedId = null; });
    api.onHide && api.onHide(() => store.save());

    this.last = Date.now();
    requestAnimationFrame(() => this.frame());
  },

  register(name, scene) { this.scenes[name] = scene; },

  switchTab(name) {
    this.tab = name;
    this.stack = [];
    const s = this.scenes[name];
    if (s && s.onEnter) s.onEnter();
  },
  push(name, params) {
    const s = this.scenes[name];
    if (!s) return;
    s.params = params || {};
    if (s.onEnter) s.onEnter(params);
    this.stack.push(s);
  },
  pop() {
    const s = this.stack.pop();
    if (s && s.onExit) s.onExit();
    const top = this.top();
    if (top && top.onEnter) top.onEnter();
  },
  top() {
    return this.stack.length ? this.stack[this.stack.length - 1] : this.scenes[this.tab];
  },

  frame() {
    const now = Date.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;

    const s = this.top();
    if (s) {
      if (s.update) s.update(dt);
      ui.begin(this.ctx, this.W, this.H, dt);
      // 背景
      const ctx = this.ctx;
      ctx.fillStyle = T.BG;
      ctx.fillRect(0, 0, this.W, this.H);
      const g = ctx.createRadialGradient(this.W / 2, -60, 40, this.W / 2, -60, 420);
      g.addColorStop(0, 'rgba(217,169,78,0.08)');
      g.addColorStop(1, 'rgba(217,169,78,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.W, this.H);
      if (s.draw) s.draw(dt);
      this.drawFloatersIfBattle(s, dt);
      if (!this.stack.length) this.drawTabBar();
      ui.drawFloaters(dt);
      ui.drawToast();
      ads.frame(dt); // 模拟广告覆盖层（置顶）
      ui.end && ui.end();
    }
    requestAnimationFrame(() => this.frame());
  },
  drawFloatersIfBattle(s, dt) {
    // 战斗场景自己管理飘字坐标；其他场景飘字由 ui.drawFloaters 统一绘制
  },

  drawTabBar() {
    const ctx = this.ctx;
    const h = 52, y = this.H - h;
    ctx.save();
    const g = ctx.createLinearGradient(0, y, 0, this.H);
    g.addColorStop(0, '#241a10'); g.addColorStop(1, '#171009');
    ctx.fillStyle = g;
    ctx.fillRect(0, y, this.W, h);
    ctx.strokeStyle = T.LINE;
    ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(this.W, y + 0.5); ctx.stroke();
    const each = this.W / this.TABS.length;
    this.TABS.forEach((t, i) => {
      const cx = each * i + each / 2;
      const active = this.tab === t.key;
      ui.tap(each * i, y, each, h, () => this.switchTab(t.key), 'tab-' + t.key);
      ctx.textAlign = 'center';
      ctx.font = T.font(20);
      ctx.globalAlpha = active ? 1 : 0.6;
      ctx.fillStyle = active ? '#e9c47a' : '#a6906c';
      ctx.fillText(t.icon, cx, y + 20);
      ctx.font = T.font(10);
      ctx.fillText(t.text, cx, y + 39);
      ctx.globalAlpha = 1;
      if (active) {
        const gx = ctx.createLinearGradient(cx - 22, 0, cx + 22, 0);
        gx.addColorStop(0, 'rgba(240,207,138,0)');
        gx.addColorStop(0.5, '#f0cf8a');
        gx.addColorStop(1, 'rgba(240,207,138,0)');
        ctx.fillStyle = gx;
        ctx.fillRect(cx - 22, y, 44, 2);
      }
    });
    ctx.restore();
  },

  // 通用页面头（返回 + 标题）
  pageHeader(title) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(23,16,9,0.9)';
    ctx.fillRect(0, 0, this.W, 42);
    ctx.strokeStyle = T.LINE;
    ctx.beginPath(); ctx.moveTo(0, 42.5); ctx.lineTo(this.W, 42.5); ctx.stroke();
    ui.text(title, this.W / 2, 16, { size: 16, color: T.GOLD_HI, bold: true, align: 'center' });
    ctx.font = T.font(16);
    ctx.fillStyle = T.GOLD;
    ctx.textBaseline = 'middle';
    ctx.fillText('‹ 返回', 12, 22);
    ui.tap(0, 0, 64, 42, () => this.pop(), 'back');
    ctx.restore();
  },

  // 资源条（通用）
  resBar(y, keys) {
    const s = store.getState();
    const F = require('../utils/fmt');
    const list = keys || ['gold', 'gem', 'scroll', 'exp'];
    const names = { gold: '🪙', gem: '💵', scroll: '📜', exp: '📕', token: '🎫', shard: '💠' };
    let x = 8;
    list.forEach(k => {
      const v = k === 'scroll' || k === 'token' || k === 'shard' ? s.res[k] : F.fmtNum(s.res[k]);
      const label = names[k] + ' ' + v;
      const w = ui.textWidth(label, 11) + 18;
      uiPanelPill(this, x, y, w, 20);
      ui.text(label, x + w / 2, y + 10, { size: 11, color: T.GOLD_HI, align: 'center', baseline: 'middle' });
      x += w + 6;
    });
  }
};
function uiPanelPill(app, x, y, w, h) {
  const ctx = app.ctx;
  ctx.save();
  const r = h / 2;
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
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();
  ctx.strokeStyle = T.LINE;
  ctx.stroke();
  ctx.restore();
}

module.exports = { app, ui };
