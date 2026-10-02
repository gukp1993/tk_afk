import { Color, EventTouch, Graphics, Label, LabelOutline, Mask, Node, ScrollView, Sprite, SpriteFrame, UITransform, Vec2, Vec3, Tween, UIOpacity } from 'cc';
import { ArtService } from '../services/ArtService';

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

  /** Artwork stays inside the existing box; sliced borders keep their thickness. */
  private skin(node: Node, key: string, w: number, h: number, sliced = true) {
    const frame = ArtService.frame(key);
    if (!frame) return false;
    const art = new Node(node.name + 'Skin');
    art.addComponent(UITransform).setContentSize(w, h);
    const sprite = art.addComponent(Sprite);
    sprite.spriteFrame = frame;
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.type = sliced ? Sprite.Type.SLICED : Sprite.Type.SIMPLE;
    sprite.trim = false;
    // Assigning a SpriteFrame can restore its native size; apply the layout box last.
    art.getComponent(UITransform)!.setContentSize(w, h);
    node.addChild(art);
    return true;
  }

  private panelSkin(node: Node, w: number, h: number, fill: Color, radius: number) {
    if (w >= 80 && h >= 32 && radius < 25 && fill.a >= 230 &&
      /Sort|ForgeSlot|ForgeDir|PresetChip|ShardTier|Filter|Chip/.test(node.name)) {
      return this.skin(node, 'ui_frame', w, h);
    }
    // Round seals, portrait placeholders, translucent overlays and tiny chips keep their own shape.
    if (w < 120 || h < 38 || radius >= 25 || fill.a < 230 ||
      /Shade|Card|Face|HeroToken|Portrait|Avatar|Sort|Faction|ForgeSlot|ForgeDir|PresetChip|ShardTier|Filter|Chip/.test(node.name)) return false;
    const light = fill.r * .299 + fill.g * .587 + fill.b * .114 > 145;
    const red = fill.r > fill.g * 1.5 && fill.r > 95 && fill.g < 100;
    return this.skin(node, light ? 'ui_panel_paper' : red ? 'ui_button_red' : 'ui_panel_jade', w, h);
  }

  /** Round seal mark with one glyph — icons paint over it via ArtService when art/icons/<key>.png exists. */
  seal(name: string, x: number, y: number, size: number, glyph: string,
    fill = palette.ink, border = palette.gold, color = palette.gold, fontSize = Math.round(size * 0.5), artKey?: string) {
    const frame = artKey ? ArtService.frame(artKey) : null;
    if (frame) {
      const node = new Node(name);
      node.setPosition(new Vec3(x, this.y(y), 0));
      node.addComponent(UITransform).setContentSize(size, size);
      const sprite = node.addComponent(Sprite);
      sprite.spriteFrame = frame;
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.trim = false;
      this.parent.addChild(node);
      this.nodes.set(name, node);
      return node;
    }
    this.panel(name, x, y, size, size, fill, size / 2, border);
    this.text(name + 'Glyph', glyph, x, y, size - 4, fontSize, color);
    return this.nodes.get(name);
  }

  /**
   * Unified hero token: faction fill, rarity rim and surname glyph as placeholder;
   * when ArtService has art/heroes/<artKey>.png the portrait covers the box (等比居中裁切) and rim/状态角标保留.
   * Every page draws hero faces through this method; restoring real portraits later only rewrites its body.
   */
  heroIcon(name: string, x: number, y: number, w: number, h: number,
    info: { surname: string; faction?: string; rarity?: number; locked?: boolean; formed?: boolean; artKey?: string }) {
    const rarity = Math.min(4, Math.max(1, Math.round(info.rarity || 1)));
    const radius = Math.min(14, w * 0.12, h * 0.12);
    const frame = info.artKey ? ArtService.frame(info.artKey) : null;
    let node: Node;
    if (frame) {
      node = new Node(name);
      node.setPosition(new Vec3(x, this.y(y), 0));
      node.addComponent(UITransform).setContentSize(w, h);
      const holder = new Node(name + 'Art');
      holder.addComponent(UITransform).setContentSize(w, h);
      const mask = holder.addComponent(Mask);
      mask.type = Mask.Type.GRAPHICS_RECT;
      // Mask 只裁子节点：Sprite 放子级，按 cover 等比缩放居中（立绘统一竖版 3:4，小盒型裁两侧）
      const artNode = new Node(name + 'Pic');
      const rect = frame.getOriginalSize();
      const scale = Math.max(w / rect.width, h / rect.height);
      artNode.addComponent(UITransform).setContentSize(Math.ceil(rect.width * scale), Math.ceil(rect.height * scale));
      const sprite = artNode.addComponent(Sprite);
      sprite.spriteFrame = frame;
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.trim = false;
      // spriteFrame 的赋值会应用默认 TRIMMED 尺寸，必须在赋图后恢复最终尺寸。
      artNode.getComponent(UITransform)!.setContentSize(Math.ceil(rect.width * scale), Math.ceil(rect.height * scale));
      // 编队和十连使用横向小框，裁切中心上移，优先保留脸部而非腰腹。
      if (w > h) artNode.setPosition(new Vec3(0, -(Math.ceil(rect.height * scale) - h) * 0.35, 0));
      holder.addChild(artNode);
      node.addChild(holder);
      this.parent.addChild(node);
      this.nodes.set(name, node);
      const rim = new Node(name + 'Rim');
      rim.addComponent(UITransform).setContentSize(w, h);
      const rg = rim.addComponent(Graphics);
      rg.strokeColor = hexColor(rarityColors[rarity]);
      rg.lineWidth = 3;
      rg.roundRect(-w / 2 + 1.5, -h / 2 + 1.5, w - 3, h - 3, radius);
      rg.stroke();
      node.addChild(rim);
    } else {
      node = this.panel(name, x, y, w, h, hexColor(factionColors[info.faction || 'all'] || factionColors.all), radius, undefined, false);
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
    }
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

  /** 整幅图片层（页面背景用）：有图由调用方传入 SpriteFrame，随 CocosUi 纵向缩放铺满。 */
  image(name: string, frame: SpriteFrame, x: number, y: number, w: number, h: number) {
    const node = new Node(name);
    node.setPosition(new Vec3(x, this.y(y), 0));
    node.addComponent(UITransform).setContentSize(w, this.height(h));
    const sprite = node.addComponent(Sprite);
    sprite.spriteFrame = frame;
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.trim = false;
    this.parent.addChild(node);
    this.nodes.set(name, node);
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
    if (/Panel$|NavBackground|CityHeader/.test(name)) this.panelSkin(node, w, drawnH, fill, 0);
    this.parent.addChild(node);
    this.nodes.set(name, node);
    return node;
  }

  panel(name: string, x: number, y: number, w: number, h: number, fill: Color, radius = 8, border?: Color, artwork = true) {
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
    if (artwork && this.panelSkin(node, w, h, fill, radius) && border) {
      const rim = new Node(name + 'StateRim');
      rim.addComponent(UITransform).setContentSize(w, h);
      const edge = rim.addComponent(Graphics);
      edge.strokeColor = border;
      edge.lineWidth = 1;
      edge.roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, radius);
      edge.stroke();
      node.addChild(rim);
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
  static floaters: { node: Node; opacity: UIOpacity; baseY: number; elapsed: number }[] = [];
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
    CocosUi.floaters.push({ node, opacity, baseY: y, elapsed: 0 });
  }
  /** 每帧由 Bootstrap.update 驱动（暂停安全、帧率无关）。 */
  static updateFloaters(dt: number) {
    for (let i = CocosUi.floaters.length - 1; i >= 0; i--) {
      const f = CocosUi.floaters[i];
      f.elapsed += dt * 1000;
      const t = Math.min(1, f.elapsed / 1200);
      if (f.node.isValid) {
        f.node.setPosition(new Vec3(0, f.baseY + 80 * t, 0));
        f.opacity.opacity = Math.floor(255 * (1 - t));
      }
      if (t >= 1) { if (f.node.isValid) f.node.destroy(); CocosUi.floaters.splice(i, 1); }
    }
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
      if (Math.hypot(point.x - startX, point.y - startY) < 12) { (globalThis as any).__lastTap = name; action(); }
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
    if (size >= 28) {
      const outline = node.addComponent(LabelOutline);
      outline.color = new Color(20, 25, 20, 190);
      outline.width = 1;
    }
    if (name === 'CityTitle' && value === '挂机定三国' && this.skin(node, 'ui_logo', w, 40, false)) label.enabled = false;
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

  /** 查本页是否已画某节点（跨屏协调用：如英雄页有背景图时让出全屏底色）。 */
  has(name: string) { return this.nodes.has(name); }

  /** 按名取节点（A0 战斗 fx 按 Fighter{i} 定位受击者/施放者用；nodes 保持私有）。 */
  node(name: string): Node | undefined { return this.nodes.get(name); }

  /**
   * 统一左上返回（I1 交互线组件）：‹ 返回 · 22 号金字 · 热区 140×52 · 基线 y=484。
   * 各页 fallback 语义留在调用点；自定义标签如 '‹ 返回点将台'。
   */
  backBar(action: () => void, label = '‹ 返回', y = 484) {
    this.text('BackBar', label, -291, y, 130, 22, palette.gold);
    this.tap('BackBarTap', -291, y, 140, 52, action);
    return this.nodes.get('BackBar');
  }

  setText(name: string, value: string) {
    const label=this.nodes.get(name)?.getComponent(Label);
    if (label) label.string=value;
  }

  button(name: string, value: string, x: number, y: number, w: number, h: number, action: () => void, fill = palette.red, immediate = false) {
    const background = this.panel(name, x, y, w, h, fill, 8, palette.gold);
    const light = fill.r * .299 + fill.g * .587 + fill.b * .114 > 145;
    this.text(name + 'Text', value, x, y, w - 12, 22, light ? palette.ink : palette.text);
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
