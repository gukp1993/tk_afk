// 离屏渲染器：把 Canvas 2D 调用录制成 SVG，供浏览器审查
// 支持子集：fillRect/strokeRect/fillText/path(fill/stroke)/渐变/clip/translate/scale/rotate/save/restore/全局透明度
class SvgCtx {
  constructor(w, h) {
    this.W = w; this.H = h;
    this.ops = [];
    this.defs = [];
    this.defId = 0;
    this.stack = [];
    // 当前变换
    this.m = [1, 0, 0, 1, 0, 0]; // a b c d e f
    this.alpha = 1;
    this.fillStyle = '#000';
    this.strokeStyle = '#000';
    this.lineWidth = 1;
    this.font = '14px sans-serif';
    this.textAlign = 'left';
    this.textBaseline = 'alphabetic';
    this.globalAlpha = 1;
    this._path = [];
    this._dash = null;
  }
  save() { this.stack.push({ m: this.m.slice(), alpha: this.globalAlpha, dash: this._dash,
    styles: { fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth,
      font: this.font, textAlign: this.textAlign, textBaseline: this.textBaseline } }); }
  // 每帧开始：清空累计指令
  newFrame() {
    this.ops = []; this.defs = []; this.defId = 0;
    this._gradRegistered = null;
    this.stack = [];
    this.m = [1, 0, 0, 1, 0, 0];
    this.globalAlpha = 1;
    this._path = [];
    this._dash = null;
  }
  restore() {
    const s = this.stack.pop();
    if (!s) return;
    this.m = s.m; this.globalAlpha = s.alpha; this._dash = s.dash;
    if (s.styles) Object.assign(this, s.styles);
    if (s.isClipGroup) this.ops.push('</g>');
  }
  transform(a, b, c, d, e, f) {
    const m = this.m, n = [a * m[0] + b * m[2], a * m[1] + b * m[3], c * m[0] + d * m[2], c * m[1] + d * m[3], e * m[0] + f * m[2] + m[4], e * m[1] + f * m[3] + m[5]];
    this.m = n;
  }
  translate(x, y) { this.transform(1, 0, 0, 1, x, y); }
  scale(x, y) { this.transform(x, 0, 0, y, 0, 0); }
  rotate(t) {
    const c = Math.cos(t), s = Math.sin(t);
    this.transform(c, s, -s, c, 0, 0);
  }
  apply(x, y) {
    const m = this.m;
    return [x * m[0] + y * m[2] + m[4], x * m[1] + y * m[3] + m[5]];
  }
  fillRect(x, y, w, h) { this._rect(x, y, w, h, this.fillStyle, true); }
  strokeRect(x, y, w, h) { this._rect(x, y, w, h, this.strokeStyle, false); }
  clearRect(x, y, w, h) { this._rect(x, y, w, h, '#171009', true); }
  _rect(x, y, w, h, style, fill) {
    const p1 = this.apply(x, y), p2 = this.apply(x + w, y), p3 = this.apply(x + w, y + h), p4 = this.apply(x, y + h);
    const d = `M${p1}L${p2}L${p3}L${p4}Z`;
    this._emitPath(d, style, fill);
  }
  beginPath() { this._path = []; }
  moveTo(x, y) { this._path.push('M' + this.apply(x, y)); }
  lineTo(x, y) { this._path.push('L' + this.apply(x, y)); }
  closePath() { this._path.push('Z'); }
  rect(x, y, w, h) {
    this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath();
  }
  arc(x, y, r, a0, a1) {
    const full = Math.abs(a1 - a0) >= Math.PI * 2 - 0.001;
    if (full && !this._path.length) {
      // 整圆：记为圆命令
      this._path.push({ circle: [this.apply(x, y), r * Math.sqrt(Math.abs(this.m[0] * this.m[3] - this.m[1] * this.m[2])) || r] });
      this._path.push('M-1,-1'); // 占位避免空
      return;
    }
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (a1 - a0) * (i / steps);
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      this._path.push((this._path.length ? 'L' : 'M') + this.apply(px, py));
    }
  }
  clip() {
    // 取当前路径包围盒做矩形裁剪
    const xs = [], ys = [];
    this._path.forEach(seg => {
      if (typeof seg === 'string') {
        const pts = seg.match(/-?[\d.]+,-?[\d.]+/g) || [];
        pts.forEach(p => { const [a, b] = p.split(',').map(Number); xs.push(a); ys.push(b); });
      }
    });
    if (!xs.length) { this._path = []; return; }
    const x = Math.min(...xs) - 1, y = Math.min(...ys) - 1;
    const w = Math.max(...xs) - x + 2, h = Math.max(...ys) - y + 2;
    const id = 'clip' + (this.defId++);
    this.defs.push(`<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>`);
    this.ops.push(`<g clip-path="url(#${id})">`);
    this.stack.push({ m: this.m.slice(), alpha: this.globalAlpha, dash: this._dash, isClipGroup: true });
    this._path = [];
  }
  setLineDash(d) { this._dash = d && d.length ? d : null; }
  fill() { this._emitJoined(this.fillStyle, true); }
  stroke() { this._emitJoined(this.strokeStyle, false); }
  _emitJoined(style, fill) {
    if (!this._path.length) return;
    // 含整圆
    const circles = this._path.filter(s => typeof s === 'object');
    const segs = this._path.filter(s => typeof s === 'string' && s !== 'M-1,-1');
    circles.forEach(c => {
      this.ops.push(`<circle cx="${c.circle[0][0]}" cy="${c.circle[0][1]}" r="${c.circle[1]}" fill="${fill ? style : 'none'}" stroke="${fill ? 'none' : style}" stroke-width="${this.lineWidth}" opacity="${this.globalAlpha}"/>`);
    });
    if (segs.length) this._emitPath(segs.join(''), style, fill);
    // Canvas 的 fill/stroke 不清空当前路径，下一次 beginPath 才重置。
  }
  _emitPath(d, style, fill) {
    const attrs = [
      `d="${d}"`,
      `fill="${fill ? style : 'none'}"`,
      fill ? '' : `stroke="${style}" stroke-width="${this.lineWidth}"`,
      !fill && this._dash ? `stroke-dasharray="${this._dash.join(' ')}"` : '',
      this.globalAlpha < 1 ? `opacity="${this.globalAlpha}"` : ''
    ].filter(Boolean).join(' ');
    this.ops.push(`<path ${attrs}/>`);
  }
  createLinearGradient(x0, y0, x1, y1) {
    if (![x0, y0, x1, y1].every(Number.isFinite)) {
      console.error('NaN gradient!', [x0, y0, x1, y1], new Error().stack.split('\n').slice(1, 6).join('\n'));
    }
    return this._grad('linear', [[x0, y0], [x1, y1]]);
  }
  createRadialGradient(x0, y0, r0, x1, y1, r1) { return this._grad('radial', [[x1, y1], r1]); }
  _grad(type, geo) {
    const id = 'g' + (this.defId++);
    const g = { id, type, geo, stops: [], addColorStop(o, c) { this.stops.push([o, c]); } };
    this._pendingGrad = g;
    return g;
  }
  measureText(str) {
    str = '' + str;
    let w = 0;
    // CJK 按 1.08em 估宽（与 headless Chrome 楷体回退渲染对齐，偏保守防溢出）
    for (const ch of str) w += ch.charCodeAt(0) > 255 ? 1.08 : 0.56;
    const size = parseFloat((this.font.match(/(\d+(?:\.\d+)?)px/) || [0, 14])[1]);
    return { width: w * size * (this.font.indexOf('bold') >= 0 ? 1.02 : 1) };
  }
  set fillStyle(v) {
    if (v && v.__isGrad !== false && typeof v === 'object' && v.id) {
      if (!this._gradRegistered) this._gradRegistered = new Set();
      if (!this._gradRegistered.has(v.id)) {
        this._gradRegistered.add(v.id);
        this._registerGrad(v);
      }
      this._fill = 'url(#' + v.id + ')';
    } else this._fill = v;
  }
  get fillStyle() { return this._fill; }
  _registerGrad(g) {
    if (g.type === 'linear') {
      const [p0, p1] = g.geo;
      const a = this.apply(...p0), b = this.apply(...p1);
      this.defs.push(`<linearGradient id="${g.id}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" gradientUnits="userSpaceOnUse">` +
        g.stops.map(s => `<stop offset="${s[0]}" stop-color="${s[1]}"/>`).join('') + '</linearGradient>');
    } else {
      const [c, r] = g.geo;
      const a = this.apply(...c);
      this.defs.push(`<radialGradient id="${g.id}" cx="${a[0]}" cy="${a[1]}" r="${r}" gradientUnits="userSpaceOnUse">` +
        g.stops.map(s => `<stop offset="${s[0]}" stop-color="${s[1]}"/>`).join('') + '</radialGradient>');
    }
  }
  set strokeStyle(v) { this._stroke = v; }
  get strokeStyle() { return this._stroke; }
  set font(f) { this._font = f; }
  get font() { return this._font; }
  fillText(str, x, y) {
    const p = this.apply(x, y);
    const size = parseFloat((this.font.match(/(\d+(?:\.\d+)?)px/) || [0, 14])[1]);
    const bold = this.font.indexOf('bold') >= 0 ? ' font-weight="bold"' : '';
    const family = this.font.includes('Kaiti')
      ? "'Kaiti SC','STKaiti','Apple Color Emoji','PingFang SC',serif"
      : "'Apple Color Emoji','Kaiti SC',serif";
    let anchor = 'start', dy = 0;
    if (this.textAlign === 'center') anchor = 'middle';
    if (this.textAlign === 'right') anchor = 'end';
    if (this.textBaseline === 'middle') dy = size * 0.35;
    else if (this.textBaseline === 'top') dy = size * 0.8;
    this.ops.push(`<text x="${p[0]}" y="${p[1] + dy}" font-size="${size}"${bold} font-family=${JSON.stringify(family)} fill="${this.fillStyle}" text-anchor="${anchor}" opacity="${this.globalAlpha}">${('' + str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>`);
  }
  drawImage() {}
  takeSVG() {
    // 收缩未闭合的 clip 组
    const tail = this.stack.filter(s => s.isClipGroup).map(() => '</g>').join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.W}" height="${this.H}" viewBox="0 0 ${this.W} ${this.H}">` +
      (this.defs.length ? '<defs>' + this.defs.join('') + '</defs>' : '') +
      `<rect width="${this.W}" height="${this.H}" fill="#171009"/>` +
      this.ops.join('') + tail + '</svg>';
  }
}
module.exports = { SvgCtx };
