import { Color, Graphics, Label, LabelOutline, Node, UIOpacity, UITransform, Vec3 } from 'cc';
import { CocosUi, hexColor } from '../ui/CocosUi';

/**
 * A0 战斗表现层管线（三线打磨 A 线基建，纯表现层、零规则改动）：
 * 每帧消费 `fighting.step().events` 与一次 `snapshot()`，生成伤害数字（dmgNum）与
 * 大招横幅（ultBanner）两类 one-shot fx；由 `Bootstrap.update` 战斗分支驱动
 * `feed → tick(dt, speed)`，帧率无关（对齐 CocosUi.floaters 模式）。
 * - 视觉参数照抄旧 combatPopupDisplay/DmgNum/UltPopup 死路渲染路径（寿命/字号/配色/位移）。
 * - fx 全部挂 `CocosUi.ensureFxLayer`（与 content 同坐标系，跨页存活）——所以进场/离场
 *   钩子必须全覆盖（startBattle/startWeekBoss/startReplay/finishBattle/go 离场）。
 * - `node.isValid` 判定自清理；到期先写回坐标再销毁；A1+ 的 hitFlash/shake/lunge 等复用本管线。
 */

const GOLD = hexColor('#e3ba70'); // 现状 UltPopup 金框/金字
const DMG_LIFE = 0.8;             // 伤害数字寿命秒（现状 800ms；×N 倍速由 tick 按 speed 压缩）
const DMG_RISE = 60;              // 上飘距离（现状线性 60px）
const ULT_LIFE = 1.2;             // 横幅寿命（前 0.9s 全亮 230，末 0.3s 淡出）
const MAX_DMG_NUM = 24;           // 同屏伤害数字上限（规格 6.3 预算）

interface BfxItem {
  kind: 'dmgNum' | 'ultBanner';
  node: Node;                     // 本模块创建的 overlay（挂 fxLayer）
  opacity: UIOpacity | null;
  elapsed: number;
  duration: number;               // 秒；elapsed += dt * speed
  data: { baseX: number; baseY: number };
}

export class BattleFx {
  private static items: BfxItem[] = [];

  /** 现存 fx 数（__tkDiag().fx 机检：跨场残留断言用）。 */
  static get live(): number { return BattleFx.items.length; }

  /** 新战斗/离场重置：销毁本模块创建的全部 overlay（含跨场残留与回放路径）。 */
  static reset() {
    for (const f of BattleFx.items) {
      if (f.node.isValid) { f.node.removeFromParent(); f.node.destroy(); }
    }
    BattleFx.items = [];
  }

  /** finishBattle 钩子（语义命名便于回读），内部即 reset。 */
  static onBattleEnd() { BattleFx.reset(); }

  /**
   * 每帧把 `step().events` 与一次 `snapshot()` 传入（仅 battle 页调用，防 fx 泄到其他页）。
   * 内部按 snapshot 下标建 uid→节点序号映射：snapshot 数组下标 = 战斗页节点序号 i
   * （drawFighter/refreshBattleView 同一序号，节点名 Fighter{i}）。
   * content 仅用于定位 fxLayer（与 content 同父同坐标系，overlay 直接 copy 目标节点 position）。
   */
  static feed(events: any[], snapshot: any[], ui: CocosUi, content: Node) {
    if (!events || !events.length || !ui || !content) return;
    const indexByUid = new Map<string, number>();
    for (let i = 0; i < snapshot.length; i++) indexByUid.set(snapshot[i].uid, i);
    const layer = CocosUi.ensureFxLayer(content);
    for (const ev of events) {
      if (!ev) continue;
      if (ev.e === 'hit') BattleFx.spawnDmgNum(layer, ui, ev, indexByUid);
      else if (ev.e === 'ult') BattleFx.spawnUltBanner(layer, ui, ev, indexByUid);
    }
  }

  /** 帧率无关驱动：elapsed += dt * speed（×4 时动画同步加快，对齐 popupLife/refreshGap 除速惯例）。 */
  static tick(dt: number, speed: number) {
    const advance = dt * (speed || 1);
    for (let i = BattleFx.items.length - 1; i >= 0; i--) {
      const f = BattleFx.items[i];
      if (!f.node || !f.node.isValid) { BattleFx.items.splice(i, 1); continue; }
      f.elapsed += advance;
      const t = Math.min(1, f.elapsed / f.duration);
      if (f.kind === 'dmgNum') {
        f.node.setPosition(new Vec3(f.data.baseX, f.data.baseY - DMG_RISE * t, 0));
        if (f.opacity) f.opacity.opacity = Math.max(0, Math.floor(255 * (1 - t)));
      } else { // ultBanner：前 0.9s 全亮，末 0.3s 淡出（现状 230→0 参数换算为节点透明度）
        if (f.opacity) {
          f.opacity.opacity = f.elapsed < 0.9 ? 255
            : Math.max(0, Math.floor(255 * (f.duration - f.elapsed) / (f.duration - 0.9)));
        }
      }
      if (t >= 1) {
        f.node.removeFromParent();
        f.node.destroy();
        BattleFx.items.splice(i, 1);
      }
    }
  }

  /** 单位寻址 + 守卫：援军 slot=5 越界时节点 x=undefined（backX[2]），isFinite 不合法则本帧动效跳过。 */
  private static anchorOf(indexByUid: Map<string, number>, ui: CocosUi, uid: string): { x: number; y: number } | null {
    const idx = indexByUid.get(uid);
    if (idx === undefined) return null;
    const node = ui.node('Fighter' + idx);
    if (!node || !node.isValid) return null;
    const p = node.position;
    if (!isFinite(p.x) || !isFinite(p.y)) return null;
    return { x: p.x, y: p.y };
  }

  private static countKind(kind: 'dmgNum' | 'ultBanner'): number {
    let n = 0;
    for (const f of BattleFx.items) if (f.kind === kind) n++;
    return n;
  }

  /** 伤害数字（hit 事件）：受击者头顶 ±40 抖动，暴击 32 号橙/普通 24 号淡黄，0.8s 上飘 60px 线性淡出。 */
  private static spawnDmgNum(layer: Node, ui: CocosUi, ev: any, indexByUid: Map<string, number>) {
    if (BattleFx.countKind('dmgNum') >= MAX_DMG_NUM) return;
    const anchor = BattleFx.anchorOf(indexByUid, ui, ev.uid);
    if (!anchor) return;
    const crit = !!ev.crit;
    const fontSize = crit ? 32 : 24;
    const node = new Node('BfxDmg');
    // 头顶锚点（现状 -30）+ 现状死路渲染的 -100 起始偏移：数字带在卡面/名字上方，不与血条重叠
    const baseX = anchor.x + Math.floor(Math.random() * 80 - 40);
    const baseY = anchor.y - 130;
    node.setPosition(new Vec3(baseX, baseY, 0));
    node.addComponent(UITransform).setContentSize(120, Math.max(fontSize * 2.4, 46));
    const label = node.addComponent(Label);
    label.string = String(ev.amount);
    label.fontFamily = 'Kaiti SC';
    label.fontSize = fontSize;
    label.lineHeight = fontSize * 1.3;
    label.color = crit ? new Color(255, 120, 40, 255) : new Color(255, 255, 200, 255);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.SHRINK;
    if (fontSize >= 28) { // 对齐 U.text：≥28 号自动描边
      const outline = node.addComponent(LabelOutline);
      outline.color = new Color(20, 25, 20, 190);
      outline.width = 1;
    }
    layer.addChild(node);
    const opacity = node.addComponent(UIOpacity);
    BattleFx.items.push({ kind: 'dmgNum', node, opacity, elapsed: 0, duration: DMG_LIFE, data: { baseX, baseY } });
  }

  /** 大招横幅（ult 事件）：施放者头顶（pos+(0,-80)），260×42 金框，1.2s 淡出。Graphics 只画一次，淡出走 UIOpacity。 */
  private static spawnUltBanner(layer: Node, ui: CocosUi, ev: any, indexByUid: Map<string, number>) {
    const anchor = BattleFx.anchorOf(indexByUid, ui, ev.uid);
    if (!anchor) return;
    const node = new Node('BfxUlt');
    const baseX = anchor.x;
    const baseY = anchor.y - 80;
    node.setPosition(new Vec3(baseX, baseY, 0));
    node.addComponent(UITransform).setContentSize(260, 42);
    const g = node.addComponent(Graphics);
    g.fillColor = new Color(46, 26, 12, 230);
    g.roundRect(-130, -21, 260, 42, 6);
    g.fill();
    g.strokeColor = GOLD;
    g.lineWidth = 2;
    g.roundRect(-129, -20, 258, 40, 6);
    g.stroke();
    const textNode = new Node('BfxUltText');
    textNode.addComponent(UITransform).setContentSize(250, 46);
    const label = textNode.addComponent(Label);
    label.string = String(ev.skill || '');
    label.fontFamily = 'Kaiti SC';
    label.fontSize = 20;
    label.lineHeight = 26;
    label.color = GOLD;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.SHRINK;
    node.addChild(textNode);
    layer.addChild(node);
    const opacity = node.addComponent(UIOpacity);
    BattleFx.items.push({ kind: 'ultBanner', node, opacity, elapsed: 0, duration: ULT_LIFE, data: { baseX, baseY } });
  }
}
