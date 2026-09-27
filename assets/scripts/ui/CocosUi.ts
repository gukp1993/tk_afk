import { Color, EventTouch, Graphics, Label, Mask, Node, ScrollView, UITransform, Vec2, Vec3 } from 'cc';

export const hexColor = (hex: string) => new Color(
  parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255
);

export const palette = {
  ink: new Color(25, 35, 31), green: new Color(53, 93, 78), greenLight: new Color(133, 160, 129),
  paper: new Color(226, 213, 172), paperDark: new Color(191, 172, 127), gold: new Color(211, 163, 73),
  red: new Color(140, 65, 43), text: new Color(249, 236, 200), muted: new Color(170, 176, 151)
};

/** Native Cocos nodes: each visible element is a UITransform, Graphics or Label. */
export class CocosUi {
  private static scrollOffsets = new Map<string, number>();
  private nodes = new Map<string, Node>();
  constructor(private parent: Node, private verticalScale = 1) {}

  private y(value: number) { return value * this.verticalScale; }
  private height(value: number) { return value >= 1000 ? value * this.verticalScale : value; }

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

  tap(name: string, x: number, y: number, w: number, h: number, action: () => void) {
    const node = new Node(name);
    node.setPosition(new Vec3(x, this.y(y), 0));
    node.addComponent(UITransform).setContentSize(w, this.height(h));
    let startX = 0, startY = 0;
    node.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
      const point = event.getLocation();
      startX = point.x; startY = point.y;
    });
    node.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
      const point = event.getLocation();
      if (Math.hypot(point.x - startX, point.y - startY) < 12) action();
    });
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
