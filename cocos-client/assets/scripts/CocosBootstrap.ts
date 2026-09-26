import { _decorator, Color, Component, Graphics, Label, Node, UITransform, Vec3, sys } from 'cc';

const { ccclass } = _decorator;

/** Cocos migration proof of life. This is an isolated shell, not the V2 gameplay port. */
@ccclass('CocosBootstrap')
export class CocosBootstrap extends Component {
  private stage = 1;
  private stageLabel: Label | null = null;
  private rewardLabel: Label | null = null;

  onLoad() {
    this.stage = Number(sys.localStorage.getItem('tk_afk_cocos_stage') || 1);
    this.drawScreen();
  }

  private drawScreen() {
    const size = this.node.getComponent(UITransform)?.contentSize;
    const width = size?.width || 720;
    const height = size?.height || 1280;
    this.rect('Backdrop', width, height, new Color(23, 31, 30), 0, 0);
    this.label('Title', '挂机定三国 · Cocos 迁移验证', 32, new Color(247, 224, 164), 0, height * 0.40, width - 40);
    this.stageLabel = this.label('Stage', '', 28, new Color(255, 244, 212), 0, height * 0.26, width - 48);
    this.rewardLabel = this.label('Idle', '挂机收获：铜钱 +120/小时 · 上限 12 小时', 21, new Color(222, 205, 157), 0, height * 0.17, width - 48);
    this.rect('CampaignButton', width * 0.76, 100, new Color(134, 54, 37), 0, 0);
    this.label('CampaignButtonText', '挑战下一关', 26, new Color(255, 239, 205), 0, 0, width * 0.72);
    const button = this.node.getChildByName('CampaignButton');
    button?.on(Node.EventType.TOUCH_END, () => {
      this.stage += 1;
      sys.localStorage.setItem('tk_afk_cocos_stage', String(this.stage));
      this.refreshLabels();
    }, this);
    this.rect('NotePanel', width - 64, 138, new Color(42, 51, 48), 0, -height * 0.31);
    this.label('Note', '当前仅验证 Cocos 场景、组件、触摸和本地存档。\n尚未接入原版战斗、招募、挂机结算或双平台适配。', 18, new Color(206, 211, 192), 0, -height * 0.31, width - 92);
    this.refreshLabels();
  }

  private refreshLabels() {
    if (this.stageLabel) this.stageLabel.string = `战役进度：第 1 章 · 第 ${this.stage} 关`;
    if (this.rewardLabel) this.rewardLabel.string = `挂机收获：铜钱 +120/小时 · 上限 12 小时 · 当前 ${Math.max(0, this.stage - 1) * 120} 铜钱`;
  }

  private rect(name: string, width: number, height: number, color: Color, x: number, y: number) {
    const node = new Node(name);
    node.setPosition(new Vec3(x, y, 0));
    node.addComponent(UITransform).setContentSize(width, height);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = color;
    graphics.rect(-width / 2, -height / 2, width, height);
    graphics.fill();
    this.node.addChild(node);
    return node;
  }

  private label(name: string, text: string, fontSize: number, color: Color, x: number, y: number, width: number) {
    const node = new Node(name);
    node.setPosition(new Vec3(x, y, 0));
    node.addComponent(UITransform).setContentSize(width, fontSize * 2.4);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize * 1.35;
    label.color = color;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    this.node.addChild(node);
    return label;
  }
}
