import { Color, Graphics, Label, LabelOutline, Node, UIOpacity, UITransform, Vec3 } from 'cc';
import { CocosUi, hexColor } from '../ui/CocosUi';

/**
 * A0+A1 战斗表现层管线（三线打磨 A 线，纯表现层、零规则改动）：
 * 每帧消费 `fighting.step().events` 与一次 `snapshot()`，生成/驱动四类 fx：
 * - dmgNum：伤害数字（hit）——overlay，挂 fxLayer。
 * - ultBanner：大招横幅（ult）——overlay，挂 fxLayer。
 * - lunge：攻击位移（act）——驱动既有 `Fighter{i}`+`FighterGlyph{i}` 沿纵轴前冲回弹
 *   （战场上下排布：A 方在下 y<0 向 +y 冲、B 方在上向 -y 冲，按节点 y 符号判向）。
 * - shake：受击抖动（hit 且 src 非空）——驱动同上节点横向 ±3px 三次振荡（x 轴与纵向
 *   lunge 轴垂直，同一卡面上两种动效可同帧共存且互不遮挡；src=null 的 reflect/dot/env
 *   不抖，env 全场每秒 tick 只弹字不抖，避免常驻噪声）。
 * 由 `Bootstrap.update` 战斗分支驱动 `feed → tick(dt, speed)`，帧率无关（对齐 CocosUi.floaters 模式）。
 * - 视觉参数照抄旧 combatPopupDisplay/DmgNum/UltPopup 死路渲染路径（寿命/字号/配色/位移）。
 * - overlay 全部挂 `CocosUi.ensureFxLayer`（与 content 同坐标系，跨页存活）——所以进场/离场
 *   钩子必须全覆盖（startBattle/startWeekBoss/startReplay/finishBattle/go 离场）。
 * - 驱动型 fx（lunge/shake）不建节点，直接位移既有节点，到期/重置/节点失效时逐像素归位；
 *   同一 uid 同一时间只允许一个驱动型 fx（防两类动效同帧争写同一节点坐标）。
 * - `node.isValid` 判定自清理；overlay 到期销毁、driven 到期先写回 base 坐标再移除。
 */

const GOLD = hexColor('#e3ba70'); // 现状 UltPopup 金框/金字
const DMG_LIFE = 0.8;             // 伤害数字寿命秒（现状 800ms；×N 倍速由 tick 按 speed 压缩）
const DMG_RISE = 60;              // 上飘距离（现状线性 60px）
const ULT_LIFE = 1.2;             // 横幅寿命（前 0.9s 全亮 230，末 0.3s 淡出）
const MAX_DMG_NUM = 24;           // 同屏伤害数字上限（规格 6.3 预算）
const SHAKE_AMP = 3;              // 受击抖动幅度 px（±3）
const SHAKE_CYCLES = 3;           // 0.18s 内三次全振荡（sin 起点/终点均为 0，天然归位）
const SHAKE_DUR = 0.18;
const LUNGE_DIST = 12;            // 攻击前冲距离 px（本批规格 10~14 取中）
const LUNGE_DUR = 0.36;           // 快出慢回：0.12s easeOut 冲出 + 0.24s easeInOut 回弹
const LUNGE_OUT = 0.12;
const MAX_DRIVEN = 12;            // shake/lunge 同类并存上限（场上单位 ≤11 含援军，足额）

/** 被驱动的既有节点 + 归位基准（Fighter 与 Glyph 的 y 差 2px，各存各的 base）。 */
interface DrivenNode { node: Node; baseX: number; baseY: number; }

interface BfxItem {
  kind: 'dmgNum' | 'ultBanner' | 'shake' | 'lunge';
  node: Node | null;              // 本模块创建的 overlay（shake/lunge 不建节点，为 null）
  driven: DrivenNode[];           // 被驱动的既有节点（shake/lunge：Fighter{i}+FighterGlyph{i}）
  opacity: UIOpacity | null;
  elapsed: number;
  duration: number;               // 秒；elapsed += dt * speed
  data: { baseX: number; baseY: number; dir?: number; uid?: string };
}

export class BattleFx {
  private static items: BfxItem[] = [];

  /** 现存 fx 数（__tkDiag().fx 机检：跨场残留断言用）。 */
  static get live(): number { return BattleFx.items.length; }

  /** 新战斗/离场重置：driven 节点先逐像素归位（防中途结束残留位移），overlay 全部销毁。 */
  static reset() {
    for (const f of BattleFx.items) {
      BattleFx.restoreDriven(f);
      if (f.node && f.node.isValid) { f.node.removeFromParent(); f.node.destroy(); }
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
      if (ev.e === 'hit') {
        BattleFx.spawnDmgNum(layer, ui, ev, indexByUid);
        BattleFx.spawnShake(ui, ev, indexByUid);
      } else if (ev.e === 'ult') BattleFx.spawnUltBanner(layer, ui, ev, indexByUid);
      else if (ev.e === 'act') BattleFx.spawnLunge(ui, ev, indexByUid);
    }
  }

  /** 帧率无关驱动：elapsed += dt * speed（×4 时动画同步加快，对齐 popupLife/refreshGap 除速惯例）。 */
  static tick(dt: number, speed: number) {
    const advance = dt * (speed || 1);
    for (let i = BattleFx.items.length - 1; i >= 0; i--) {
      const f = BattleFx.items[i];
      if (f.kind === 'shake' || f.kind === 'lunge') {
        // 驱动型：任一被驱动节点失效（show() 整页重绘销毁）→ 归位剩余有效节点并弃单
        if (f.driven.some(d => !d.node.isValid)) { BattleFx.restoreDriven(f); BattleFx.items.splice(i, 1); continue; }
        f.elapsed += advance;
        const t = Math.min(1, f.elapsed / f.duration);
        let dx = 0, dy = 0;
        if (f.kind === 'shake') {
          dx = SHAKE_AMP * Math.sin(2 * Math.PI * SHAKE_CYCLES * t);
        } else { // lunge：快出（easeOut 冲到满幅）慢回（easeInOut 归零），终帧 off=0 与 base 逐像素一致
          const dir = f.data.dir || 1;
          const off = f.elapsed <= LUNGE_OUT
            ? LUNGE_DIST * BattleFx.easeOutQuad(f.elapsed / LUNGE_OUT)
            : LUNGE_DIST * (1 - BattleFx.easeInOutQuad(Math.min(1, (f.elapsed - LUNGE_OUT) / (LUNGE_DUR - LUNGE_OUT))));
          dy = dir * off;
        }
        for (const d of f.driven) d.node.setPosition(new Vec3(d.baseX + dx, d.baseY + dy, 0));
        if (t >= 1) { BattleFx.restoreDriven(f); BattleFx.items.splice(i, 1); }
        continue;
      }
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

  /** 驱动型寻址：Fighter+Glyph 成对取（6.2-7：一个单位=多个兄弟节点，动效必须同动）。 */
  private static drivenOf(indexByUid: Map<string, number>, ui: CocosUi, uid: string): DrivenNode[] | null {
    const idx = indexByUid.get(uid);
    if (idx === undefined) return null;
    const fighter = ui.node('Fighter' + idx);
    const glyph = ui.node('FighterGlyph' + idx);
    if (!fighter || !fighter.isValid || !glyph || !glyph.isValid) return null;
    const fp = fighter.position, gp = glyph.position;
    if (!isFinite(fp.x) || !isFinite(fp.y) || !isFinite(gp.x) || !isFinite(gp.y)) return null;
    return [
      { node: fighter, baseX: fp.x, baseY: fp.y },
      { node: glyph, baseX: gp.x, baseY: gp.y },
    ];
  }

  private static restoreDriven(f: BfxItem) {
    for (const d of f.driven) {
      if (d.node.isValid) d.node.setPosition(new Vec3(d.baseX, d.baseY, 0));
    }
  }

  /** 同 uid 已有驱动型 fx（lunge/shake 互斥共写同一节点坐标），新动效让位。 */
  private static hasDrivenFx(uid: string): boolean {
    for (const f of BattleFx.items) {
      if ((f.kind === 'shake' || f.kind === 'lunge') && f.data.uid === uid) return true;
    }
    return false;
  }

  private static countKind(kind: 'dmgNum' | 'ultBanner' | 'shake' | 'lunge'): number {
    let n = 0;
    for (const f of BattleFx.items) if (f.kind === kind) n++;
    return n;
  }

  private static easeOutQuad(u: number): number { return 1 - (1 - u) * (1 - u); }
  private static easeInOutQuad(u: number): number { return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; }

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
    BattleFx.items.push({ kind: 'dmgNum', node, driven: [], opacity, elapsed: 0, duration: DMG_LIFE, data: { baseX, baseY } });
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
    BattleFx.items.push({ kind: 'ultBanner', node, driven: [], opacity, elapsed: 0, duration: ULT_LIFE, data: { baseX, baseY } });
  }

  /**
   * 受击抖动（A1）：hit 事件驱 Fighter+Glyph 横向 ±3px 三次振荡 0.18s。
   * 仅直接攻击反馈：src=null（reflect/dot/env）与 env 全场 tick 不抖（6.2-4 空值兜底 + 降噪）；
   * 与 dmgNum 并发不冲突（dmgNum 是 fxLayer overlay，本动效只位移既有节点）。
   */
  private static spawnShake(ui: CocosUi, ev: any, indexByUid: Map<string, number>) {
    if (ev.src == null || ev.kind === 'env') return;
    if (BattleFx.countKind('shake') >= MAX_DRIVEN) return;
    if (BattleFx.hasDrivenFx(ev.uid)) return; // 同帧多段命中去重 + 冷却（活跃 0.18s 即天然冷却窗）
    const driven = BattleFx.drivenOf(indexByUid, ui, ev.uid);
    if (!driven) return;
    BattleFx.items.push({
      kind: 'shake', node: null, driven, opacity: null, elapsed: 0, duration: SHAKE_DUR,
      data: { baseX: driven[0].baseX, baseY: driven[0].baseY, uid: ev.uid },
    });
  }

  /**
   * 攻击位移（A1）：act 事件驱攻击者 Fighter+Glyph 沿纵轴向目标方向冲 12px 回弹（0.36s 快出慢回）。
   * 战场上下排布（6.2-1）：攻击者在下（y<0）向 +y 冲、在上向 -y 冲，按节点 y 符号判向。
   */
  private static spawnLunge(ui: CocosUi, ev: any, indexByUid: Map<string, number>) {
    if (BattleFx.countKind('lunge') >= MAX_DRIVEN) return;
    if (BattleFx.hasDrivenFx(ev.uid)) return; // 同 uid 活跃即跳过（防抖振/坐标争写）
    const driven = BattleFx.drivenOf(indexByUid, ui, ev.uid);
    if (!driven) return;
    const dir = driven[0].baseY < 0 ? 1 : -1; // A 方（下方）+y、B 方（上方）-y
    BattleFx.items.push({
      kind: 'lunge', node: null, driven, opacity: null, elapsed: 0, duration: LUNGE_DUR,
      data: { baseX: driven[0].baseX, baseY: driven[0].baseY, dir, uid: ev.uid },
    });
  }
}
