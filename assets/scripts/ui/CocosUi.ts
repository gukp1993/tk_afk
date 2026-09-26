import { Color, Graphics, Label, Node, UITransform, Vec3 } from 'cc';

export const palette = {
  ink: new Color(25, 35, 31), green: new Color(53, 93, 78), greenLight: new Color(133, 160, 129),
  paper: new Color(226, 213, 172), paperDark: new Color(191, 172, 127), gold: new Color(211, 163, 73),
  red: new Color(140, 65, 43), text: new Color(249, 236, 200), muted: new Color(170, 176, 151)
};

/** Native Cocos nodes: each visible element is a UITransform, Graphics or Label. */
export class CocosUi {
  private nodes = new Map<string, Node>();
  constructor(private parent: Node) {}

  rect(name: string, x: number, y: number, w: number, h: number, fill: Color) {
    const node = new Node(name);
    node.setPosition(new Vec3(x, y, 0));
    node.addComponent(UITransform).setContentSize(w, h);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = fill;
    graphics.rect(-w / 2, -h / 2, w, h);
    graphics.fill();
    this.parent.addChild(node);
    this.nodes.set(name, node);
    return node;
  }

  text(name: string, value: string, x: number, y: number, w: number, size = 24, color = palette.text, align = Label.HorizontalAlign.CENTER) {
    const node = new Node(name);
    node.setPosition(new Vec3(x, y, 0));
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
    const background = this.rect(name, x, y, w, h, fill);
    const caption = this.text(name + 'Text', value, x, y, w - 12, 22);
    const touchEvent = immediate ? Node.EventType.TOUCH_START : Node.EventType.TOUCH_END;
    background.on(touchEvent, action);
    caption.on(touchEvent, action);
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
    node.setPosition(new Vec3(x-w*(1-bounded)/2,y,0));
  }

  line(name: string, points: Array<[number, number]>, width: number, color: Color) {
    const node = new Node(name);
    const graphics = node.addComponent(Graphics);
    graphics.lineWidth = width;
    graphics.strokeColor = color;
    points.forEach(([x, y], i) => i ? graphics.lineTo(x, y) : graphics.moveTo(x, y));
    graphics.stroke();
    this.parent.addChild(node);
    return node;
  }
}
