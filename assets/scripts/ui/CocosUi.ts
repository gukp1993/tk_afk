import { Color, EventTouch, Graphics, Label, Mask, Node, ScrollView, UITransform, Vec2, Vec3, Tween, UIOpacity } from 'cc';

export const hexColor = (hex: string) => new Color(
  parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255
);

export const palette = {
  ink: new Color(25, 35, 31), green: new Color(53, 93, 78), greenLight: new Color(133, 160, 129),
  paper: new Color(226, 213, 172), paperDark: new Color(191, 172, 127), gold: new Color(211, 163, 73),
  red: new Color(140, 65, 43), text: new Color(249, 236, 200), muted: new Color(170, 176, 151)
};

/** Placeholder-art tokens shared by every page (design originals stay in docs/archive/2026-09/hero-ui-handoff-v1). */
export const factionColors: Record<string, string> = {
  all: '#3f5a4c', wei: '#44618f', shu: '#8a4a38', wu: '#9a7b35', qun: '#636055'
};
export const rarityColors = ['', '#c8ccd4', '#6f9fd8', '#c99af0', '#f0b95e'];

/** Native Cocos nodes: each visible element is a UITransform, Graphics or Label. */
export class CocosUi {
  private static scrollOffsets = new Map<string, number>();
  private nodes = new Map<string, Node>();
  constructor(private parent: Node, private verticalScale = 1) {}

  private y(value: number) { return value * this.verticalScale; }
  private height(value: number) { return value >= 1000 ? value * this.verticalScale : value; }

  /** Round seal mark with one glyph — the lightweight stand-in for removed icon sprites. */
  seal(name: string, x: number, y: number, size: number, glyph: string,
    fill = palette.ink, border = palette.gold, color = palette.gold, fontSize = Math.round(size * 0.5)) {
    this.panel(name, x, y, size, size, fill, size / 2, border);
    this.text(name + 'Glyph', glyph, x, y, size - 4, fontSize, color);
    return this.nodes.get(name);
  }

  /**
   * Unified placeholder hero token: faction fill, rarity rim and surname glyph.
   * Every page draws hero faces through this method; restoring real portraits later only rewrites its body.
   */
  heroIcon(name: string, x: number, y: number, w: number, h: number,
    info: { surname: string; faction?: string; rarity?: number; locked?: boolean; formed?: boolean }) {
    const rarity = Math.min(4, Math.max(1, Math.round(info.rarity || 1)));
    const radius = Math.min(14, w * 0.12, h * 0.12);
    const node = this.panel(name, x, y, w, h, hexColor(factionColors[info.faction || 'all'] || factionColors.all), radius);
    const g = node.getComponent(Graphics)!;
    g.strokeColor = hexColor(rarityColors[rarity]);
    g.lineWidth = 3;
    g.roundRect(-w / 2 + 1.5, -h / 2 + 1.5, w - 3, h - 3, radius);
    g.stroke();
    g.strokeColor = new Color(238, 218, 170, 30);
    g.lineWidth = 2;
    g.roundRect(-w / 2 + 7, -h / 2 + 7, w - 14, h - 14, Math.max(3, radius - 5));
    g.stroke();
    const glyph = new Node(name + 'Glyph');
    glyph.addComponent(UITransform).setContentSize(w * 0.72, h * 0.42);
    const label = glyph.addComponent(Label);
    label.string = (info.surname || '?').slice(0, 1);
    label.fontFamily = 'Kaiti SC';
    label.fontSize = Math.round(Math.min(w, h) * 0.36);
    label.lineHeight = label.fontSize * 1.25;
    label.color = info.locked ? palette.muted : palette.text;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.SHRINK;
    glyph.setPosition(0, info.locked ? h * 0.1 : 0, 0);
    node.addChild(glyph);
    if (info.locked) {
      const shade = new Node(name + 'Shade');
      shade.addComponent(UITransform).setContentSize(w, h);
      const s = shade.addComponent(Graphics);
      s.fillColor = new Color(6, 13, 12, 150);
      s.roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, Math.max(3, radius - 2));
      s.fill();
      node.addChild(shade);
      const tag = new Node(name + 'LockedTag');
      const tagH = Math.max(20, h * 0.09);
      tag.addComponent(UITransform).setContentSize(Math.min(w - 14, 130), tagH);
      const tl = tag.addComponent(Label);
      tl.string = '未获得';
      tl.fontFamily = 'Kaiti SC';
      tl.fontSize = Math.round(tagH * 0.62);
      tl.lineHeight = tl.fontSize * 1.2;
      tl.color = palette.muted;
      tl.horizontalAlign = Label.HorizontalAlign.CENTER;
      tl.verticalAlign = Label.VerticalAlign.CENTER;
      tl.overflow = Label.Overflow.SHRINK;
      tag.setPosition(0, -h * 0.2, 0);
      node.addChild(tag);
    }
    if (info.formed) {
      const r = Math.max(13, Math.min(21, h * 0.09));
      const badge = new Node(name + 'Formed');
      badge.setPosition(w / 2 - r - 5, h / 2 - r - 5, 0);
      badge.addComponent(UITransform).setContentSize(r * 2, r * 2);
      const bg = badge.addComponent(Graphics);
      bg.fillColor = palette.red;
      bg.circle(0, 0, r);
      bg.fill();
      bg.strokeColor = palette.gold;
      bg.lineWidth = 2;
      bg.circle(0, 0, r - 1);
      bg.stroke();
      const text = new Node(name + 'FormedText');
      text.addComponent(UITransform).setContentSize(r * 2, r * 2);
      const bl = text.addComponent(Label);
      bl.string = '战';
      bl.fontFamily = 'Kaiti SC';
      bl.fontSize = Math.round(r * 1.05);
      bl.lineHeight = bl.fontSize * 1.2;
      bl.color = palette.text;
      bl.horizontalAlign = Label.HorizontalAlign.CENTER;
      bl.verticalAlign = Label.VerticalAlign.CENTER;
      bl.overflow = Label.Overflow.SHRINK;
      badge.addChild(text);
      node.addChild(badge);
    }
    return node;
  }

  static resetScroll(name: string) { this.scrollOffsets.delete(name); }

  rect(name: string, x: number, y: number, w: number, h: number, fill: Color) {
    const node = new Node(name);
    node.setPosition(new Vec3(x, this.y(y), 0));
    const drawnH=h*this.verticalScale;
    node.addComponent(UITransform).setContentSize(w, drawnH);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = fill;
    graphics.rect(-w / 2, -drawnH / 2, w, drawnH);
    graphics.fill();
    this.parent.addChild(node);
    this.nodes.set(name, node);
    return node;
  }

  panel(name: string, x: number, y: number, w: number, h: number, fill: Color, radius = 8, border?: Color) {
    const node = new Node(name);
    node.setPosition(new Vec3(x, this.y(y), 0));
    node.addComponent(UITransform).setContentSize(w, h);
    const g = node.addComponent(Graphics);
    g.fillColor = fill;
    g.roundRect(-w / 2, -h / 2, w, h, radius);
    g.fill();
    if (border) {
      g.strokeColor = border;
      g.lineWidth = 2;
      g.roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, radius);
      g.stroke();
    }
    this.parent.addChild(node);
    this.nodes.set(name, node);
    return node;
  }

  /** 震动反馈（研讨会七 P5）：短震，wx.vibrateShort 平台调用。 */
  static vibrateShort() {
    try {
      const g = globalThis as any;
      if (g.wx && g.wx.vibrateShort) g.wx.vibrateShort({ type: 'light' });
    } catch (e) { /* 平台不支持静默 */ }
  }

  /** 领取飞字（研讨会七 P4）：浮空文字上移淡出后自毁；挂 fxLayer 不随 content 清理销毁。 */
  static fxLayer: Node | null = null;
  static ensureFxLayer(parent: Node) {
    if (!CocosUi.fxLayer || !CocosUi.fxLayer.isValid) {
      CocosUi.fxLayer = new Node('FxLayer');
      parent.parent.addChild(CocosUi.fxLayer);
    }
    return CocosUi.fxLayer;
  }
  static floatText(parent: Node, x: number, y: number, text: string, color: Color) {
    const layer = CocosUi.ensureFxLayer(parent);
    const node = new Node('Floater');
    node.setPosition(new Vec3(x, y, 0));
    const transform = node.addComponent(UITransform);
    transform.setContentSize(400, 30);
    const label = node.addComponent(Label);
    label.string = text; label.fontSize = 22; label.lineHeight = 26;
    label.color = color;
    layer.addChild(node);
    const opacity = node.addComponent(UIOpacity);
    const moveTarget = { x: x, y: y };
    let elapsed = 0;
    const cb = () => {
      elapsed += 16;
      const t = Math.min(1, elapsed / 1200);
      node.setPosition(new Vec3(x, y + 80 * t, 0));
      opacity.opacity = Math.floor(255 * (1 - t));
      if (t >= 1) {
        node.destroy();
      }
    };
    const timer = setInterval(cb, 16);
    // 兜底清理
    setTimeout(() => { clearInterval(timer); if (node.isValid) node.destroy(); }, 1500);
  }

  /** 红点（研讨会七 P1）：可领取提示小圆点，挂在面板右上角。 */
  dot(name: string, x: number, y: number) {
    const node = new Node(name);
    node.setPosition(new Vec3(x, this.y(y), 0));
    node.addComponent(UITransform).setContentSize(16, 16);
    const g = node.addComponent(Graphics);
    g.circle(0, 0, 7); g.fillColor = new Color(214, 69, 56, 255);
    g.strokeColor = new Color(240, 230, 205, 255); g.lineWidth = 2; g.stroke();
    g.fill();
    this.parent.addChild(node);
    this.nodes.set(name, node);
    return node;
  }

  tap(name: string, x: number, y: number, w: number, h: number, action: () => void) {
    const node = new Node(name);
    node.setPosition(new Vec3(x, this.y(y), 0));
    node.addComponent(UITransform).setContentSize(w, this.height(h));
    let startX = 0, startY = 0;
    // 按压态（研讨会七 P1）：按下缩至 0.97 提供触觉反馈，松开/取消还原
    node.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
      const point = event.getLocation();
      startX = point.x; startY = point.y;
      node.setScale(0.97, 0.97, 1);
    });
    const release = () => node.setScale(1, 1, 1);
    node.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
      release();
      const point = event.getLocation();
      if (Math.hypot(point.x - startX, point.y - startY) < 12) action();
    });
    node.on(Node.EventType.TOUCH_CANCEL, release);
    this.parent.addChild(node);
    this.nodes.set(name, node);
    return node;
  }

  /** A clipped, native Cocos scroll area. Child coordinates are relative to its center. */
  scroll(name: string, x: number, y: number, w: number, h: number, contentH: number, draw: (ui: CocosUi) => void) {
    const viewport = new Node(name);
    viewport.setPosition(x, this.y(y));
    const viewH=h*this.verticalScale;
    viewport.addComponent(UITransform).setContentSize(w, viewH);
    viewport.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
    this.parent.addChild(viewport);
    const content = new Node(name + 'Content');
    const actualH=Math.max(contentH, viewH);
    content.addComponent(UITransform).setContentSize(w, actualH);
    viewport.addChild(content);
    const scrolling = viewport.addComponent(ScrollView);
    scrolling.content = content;
    scrolling.horizontal = false;
    scrolling.vertical = true;
    scrolling.inertia = true;
    scrolling.elastic = false;
    const layout=new Node(name + 'Layout');
    layout.setPosition(0,(actualH-contentH)/2);
    layout.addComponent(UITransform).setContentSize(w,contentH);
    content.addChild(layout);
    draw(new CocosUi(layout));
    const previous = CocosUi.scrollOffsets.get(name) || 0;
    scrolling.scrollToOffset(new Vec2(0, previous), 0);
    viewport.on(ScrollView.EventType.SCROLLING, () => {
      CocosUi.scrollOffsets.set(name, Math.max(0, scrolling.getScrollOffset().y));
    });
    this.nodes.set(name, viewport);
    return scrolling;
  }

  scene(name: string, draw: (graphics: Graphics) => void) {
    const node = new Node(name);
    const graphics = node.addComponent(Graphics);
    node.setScale(new Vec3(1, this.verticalScale, 1));
    draw(graphics);
    this.parent.addChild(node);
    this.nodes.set(name, node);
    return node;
  }

  text(name: string, value: string, x: number, y: number, w: number, size = 24, color = palette.text, align = Label.HorizontalAlign.CENTER) {
    const node = new Node(name);
    node.setPosition(new Vec3(x, this.y(y), 0));
    node.addComponent(UITransform).setContentSize(w, Math.max(size * 2.4, 46));
    const label = node.addComponent(Label);
    label.string = value;
    // Match the Canvas edition's Kaiti-first typography on every native page.
    label.fontFamily = 'Kaiti SC';
    label.fontSize = size;
    label.lineHeight = size * 1.3;
    label.color = color;
    label.horizontalAlign = align;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.SHRINK;
    this.parent.addChild(node);
    this.nodes.set(name, node);
    return node;
  }

  textBlock(name: string, value: string, x: number, y: number, w: number, h: number, size = 20, color = palette.text) {
    const node = this.text(name, value, x, y, w, size, color);
    node.getComponent(UITransform)!.setContentSize(w, h);
    const label = node.getComponent(Label)!;
    label.enableWrapText = true;
    label.overflow = Label.Overflow.CLAMP;
    return node;
  }

  setText(name: string, value: string) {
    const label=this.nodes.get(name)?.getComponent(Label);
    if (label) label.string=value;
  }

  button(name: string, value: string, x: number, y: number, w: number, h: number, action: () => void, fill = palette.red, immediate = false) {
    const background = this.panel(name, x, y, w, h, fill, 8, palette.gold);
    this.text(name + 'Text', value, x, y, w - 12, 22);
    if (immediate) {
      const touch = this.tap(name + 'Touch', x, y, w, h, action);
      touch.off(Node.EventType.TOUCH_END);
      touch.on(Node.EventType.TOUCH_START, action);
    } else this.tap(name + 'Touch', x, y, w, h, action);
    return background;
  }

  progress(name: string, x: number, y: number, w: number, ratio: number, fill = palette.gold) {
    this.rect(name + 'Bg', x, y, w, 10, palette.ink);
    this.rect(name, x, y, w, 10, fill);
    this.updateProgress(name,x,y,w,ratio);
  }

  updateProgress(name: string, x: number, y: number, w: number, ratio: number) {
    const node=this.nodes.get(name);
    if (!node) return;
    const bounded=Math.max(0.001,Math.min(1,ratio));
    node.setScale(new Vec3(bounded,1,1));
    node.setPosition(new Vec3(x-w*(1-bounded)/2,this.y(y),0));
  }

  line(name: string, points: Array<[number, number]>, width: number, color: Color) {
    const node = new Node(name);
    const graphics = node.addComponent(Graphics);
    graphics.lineWidth = width;
    graphics.strokeColor = color;
    points.forEach(([x, y], i) => i ? graphics.lineTo(x, this.y(y)) : graphics.moveTo(x, this.y(y)));
    graphics.stroke();
    this.parent.addChild(node);
    return node;
  }
}
