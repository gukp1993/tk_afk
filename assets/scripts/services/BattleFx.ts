import { Color, Graphics, Label, LabelOutline, Node, UIOpacity, UITransform, Vec3 } from 'cc';
import { CocosUi, hexColor } from '../ui/CocosUi';

/**
 * A0~A5 战斗表现层管线（三线打磨 A 线，纯表现层、零规则改动）：
 * 每帧消费 `fighting.step().events` 与一次 `snapshot()`，生成/驱动八类 fx：
 * - dmgNum：伤害数字（hit）——overlay，挂 fxLayer；A5 暴击弹跳：crit 字首帧 scale 1.6，
 *   0.18s easeOut 收拢至 1（普通字不写缩放、样式分级照旧橙 32/淡黄 24）。
 * - ultBanner：大招横幅（ult）——overlay，挂 fxLayer；A4 入场增强：自上 14px 滑入
 *   （90ms easeOut）+ 亮金描边叠加层自 255 衰减（描边加亮后回落金框），1.2s 淡出照旧。
 * - lunge：攻击位移（act）——驱动既有 `Fighter{i}`+`FighterGlyph{i}` 沿纵轴前冲回弹
 *   （战场上下排布：A 方在下 y<0 向 +y 冲、B 方在上向 -y 冲，按节点 y 符号判向）。
 * - ultLunge（A2）：大招前冲（ult）——同轴更大更慢的一次前冲（18px/0.5s，普通 lunge
 *   12px/0.36s），与 lunge/shake 共用驱动型互斥槽；banner 照常不受互斥影响。
 * - shake：受击抖动（hit 且 src 非空）——驱动同上节点横向 ±3px 三次振荡（x 轴与纵向
 *   lunge 轴垂直，同一卡面上两种动效可同帧共存且互不遮挡；src=null 的 reflect/dot/env
 *   不抖，env 全场每秒 tick 只弹字不抖，避免常驻噪声）。
 * - energyPulse（A4）：怒气满常驻呼吸——feed 先于事件扫 snapshot：`energy>=100 && alive`
 *   进呼吸态、<100 或 !alive 退出（Map<uid> 跨帧状态表，reset 清）。态内每帧写
 *   Fighter+Glyph scale=基准+0.06·sin(t·6)（≈0.96Hz 呼吸，规格字面 1+0.06·sin(t·6)，
 *   卡面基准恒 1），两枚预制 rim overlay（金/亮金 Graphics 各画一次、之后只切 active）
 *   置卡坐标 3Hz 交替——零逐帧重绘 Graphics（规格 A4 防 overdraw）。态由 snapshot 状态机
 *   驱动而非事件：满怒即呼吸（提示大招可用），castUlt 清怒即退出、缩放逐位归 1（规格
 *   "动画结束归位"）。前批 A2 的"跨阈值一次性 0.3s 脉冲"由本常驻态取代：两者同写 scale
 *   且状态机语义覆盖跨阈值语义；扫序也从"事件后"提前到"事件前"——退出归位必须先于同帧
 *   事件 fx（deathFade/ultLunge）采样基准，否则会把呼吸中的缩放误存为 base 残留永久偏移。
 * - deathFade（A3）：阵亡淡出（death）——驱动 Fighter+Glyph opacity 255→0（easeIn）+
 *   下沉 10px（0.5s），到期归位为透明终态（位置回 base、透明度保持 0）；名字/血/怒条照常由
 *   refreshBattleView 渲染（卡面消失即"阵亡"反馈）。跨帧状态表 deadFaded 记录透明终态：
 *   ①cheat 事件缺席时 snapshot.alive 回 true → 立即恢复可见（兜底复活，规格 6.2-5）；
 *   ②战斗中整页重绘重建节点（UIOpacity 丢失）→ 静默重挂透明态，防"幽灵复现"。
 * - revive（A3）：复活表现（cheat{uid,pct}，6.2-5：复活主触发是 cheat 事件而非轮询）——
 *   0.6s 内 opacity 当前值→255（easeOut）+ y 从下沉位回 0 + 一次 1→1.08→1 脉冲；有淡出
 *   fx 在跑先终结再播。注意 battle.js 的 handleDeath 里 cheat 分支先于 death 返回：赵云系
 *   首次致死只发 cheat、单位始终直立（无前置淡出）→ 从当前状态起播等效一次站立脉冲；
 *   "淡出中/已定格再被复活"的完整回升链路作为防御路径保留（规格 6.4 A3 的幽灵位防线）。
 * 由 `Bootstrap.update` 战斗分支驱动 `feed → tick(dt, speed)`，帧率无关（对齐 CocosUi.floaters 模式）。
 * - 视觉参数照抄旧 combatPopupDisplay/DmgNum/UltPopup 死路渲染路径（寿命/字号/配色/位移）。
 * - overlay 全部挂 `CocosUi.ensureFxLayer`（与 content 同坐标系，跨页存活）——所以进场/离场
 *   钩子必须全覆盖（startBattle/startWeekBoss/startReplay/finishBattle/go 离场）。
 * - 驱动型 fx（lunge/ultLunge/shake）不建节点，直接位移/缩放既有节点，
 *   到期/重置/节点失效时逐像素归位；同一 uid 同一时间只允许一个驱动型 fx
 *   （防两类动效同帧争写同一节点坐标/缩放基准）。
 * - A4 呼吸态与驱动互斥槽的关系：呼吸只写 scale（每帧最后写、终态权威），lunge/shake/
 *   ultLunge 实际只消费位移（ds 恒 0），两者正交、互不占槽；呼吸退出时归位缩放并修正
 *   呼吸期间采样的驱动 fx 基准（防把呼吸值当 base 残留）。
 * - A3 淡出/复活的互斥设计：主信道是 opacity 而非位移，**独立于三类驱动互斥槽**（不占
 *   lunge/shake/ultLunge 的槽位，deathFade/revive 两者之间同 uid 互斥——先到者
 *   被后到者终结）；但它们仍写 y 位移与缩放，因此 spawn 时终结该 uid 全部既有 fx（含
 *   呼吸态退出）取得主写权，活跃期间三类让位不再起播（死亡单位不再产生 act/hit 事件，
 *   实际重叠窗口仅致死当帧）。
 * - `node.isValid` 判定自清理；overlay 到期销毁、driven 到期先写回 base 坐标/缩放再移除
 *   （deathFade 到期例外：位置归 base、透明度保持 0 = 透明终态）。
 */

const GOLD = hexColor('#e3ba70'); // 现状 UltPopup 金框/金字
const GOLD_HI = hexColor('#ffe9b0'); // A4 亮金：呼吸 rim 交替的第二色 + 横幅入场描边加亮
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
const ULT_LUNGE_DIST = 18;        // A2 大招前冲：比普通 lunge 更大更慢，更有仪式感
const ULT_LUNGE_DUR = 0.5;        // 0.18s easeOut 冲出 + 0.32s easeInOut 回弹（无过冲，终帧零偏移）
const ULT_LUNGE_OUT = 0.18;
const BREATH_AMP = 0.06;          // A4 呼吸幅度：scale=基准+0.06·sin(t·6)（规格字面）
const BREATH_RATE = 6;            // A4 呼吸角频率 rad/s（≈0.96Hz）
const RIM_HZ = 3;                 // A4 双 rim visible 交替频率（金↔亮金）
const RIM_PAD = 2;                // A4 rim 相对卡面（90×91 r13）的外扩距离
const BANNER_SLIDE = 0.09;        // A4 横幅滑入时长（90ms easeOut）
const BANNER_SLIDE_DIST = 14;     // A4 横幅滑入起始偏移 px（y+14→0，自上落入）
const BANNER_GLOW = 0.45;         // A4 横幅描边加亮衰减时长（亮金叠加层 255→0）
const PULSE_AMP = 0.08;           // A3 复活起身脉冲：scale 1→1.08→1（sin 半波，天然起零归零）
const DEATH_DUR = 0.5;            // A3 阵亡淡出：opacity 255→0 + 下沉 10px，easeIn（先缓后快）
const DEATH_SINK = 10;            // A3 阵亡下沉距离 px（画面向下 = -y，双侧同向）
const REVIVE_DUR = 0.6;           // A3 复活回升：opacity→255 + 回升 + 1→1.08→1 脉冲
const DMG_POP = 0.18;             // A5 暴击弹跳：首帧 scale 1.6→1（0.18s easeOut），普通字不变
const DMG_POP_FROM = 1.6;         // A5 暴击弹跳起始缩放（规格字面）
const MAX_DRIVEN = 12;            // 驱动型 fx（三类动效 + A3 淡出/复活按 kind 各自计）同类并存上限（场上单位 ≤11 含援军，足额）

/** 被驱动的既有节点 + 归位基准（Fighter 与 Glyph 的 y 差 2px，各存各的 base）。
 * A3 淡出/复活额外持有透明度主写权：op 为该节点 UIOpacity（spawn 时 ensure 补挂），
 * fromOp 为起播时透明度快照（正常淡出 255 起、定格透明后复活 0 起；被中途终结的
 * 前序 fx 留下的半程值作起点，避免跳变）。 */
interface DrivenNode { node: Node; baseX: number; baseY: number; baseScale: number; op: UIOpacity | null; fromOp: number; }

interface BfxItem {
  kind: 'dmgNum' | 'ultBanner' | 'shake' | 'lunge' | 'ultLunge' | 'deathFade' | 'revive';
  node: Node | null;              // 本模块创建的 overlay（驱动型不建节点，为 null）
  driven: DrivenNode[];           // 被驱动的既有节点（驱动型：Fighter{i}+FighterGlyph{i}）
  opacity: UIOpacity | null;
  glowOp: UIOpacity | null;       // A4 ultBanner 亮金描边叠加层透明度（随横幅子节点同毁）
  elapsed: number;
  duration: number;               // 秒；elapsed += dt * speed
  data: { baseX: number; baseY: number; dir?: number; uid?: string; sunk?: boolean; pop?: boolean };
}

/** A4 怒气满常驻呼吸态：uid → 态（进态建、退出/reset 销毁）。rim 两枚 Graphics 各画一次，
 * 态内只切 active（3Hz 交替），不逐帧重绘。baseF/baseG 为进态时的缩放基准（进态有
 * hasFadeFx 守卫，采样时节点必为净基准），退出时逐位归位。 */
interface BreathState { t: number; baseF: number; baseG: number; rimGold: Node | null; rimHi: Node | null }

export class BattleFx {
  private static items: BfxItem[] = [];
  /** A4 怒气呼吸跨帧状态：uid → 常驻呼吸态（feed 按 snapshot 状态机进出；reset 清，跨场不残留）。 */
  private static breaths = new Map<string, BreathState>();
  /** A4：最近一帧 feed 的寻址上下文（呼吸写在 tick，需按 uid 解析节点；每帧刷新，
   * reset 置空——feed 只在 battle 页调用，离开即失效）。 */
  private static view: { ui: CocosUi; indexByUid: Map<string, number> } | null = null;
  /** A3 阵亡淡出跨帧状态：uid → 已进入/正在进入透明终态（death 事件置入，cheat/兜底复活
   * 移除；reset 清，跨场不残留）。供 snapshot.alive 兜底比对与重绘自愈。 */
  private static deadFaded = new Map<string, true>();

  /** 现存 fx 数（__tkDiag().fx 机检：跨场残留断言用）。A4 起计入呼吸态（rim overlay 不入
   * items，泄漏时 fx 仍须非 0 才能被机检捕获；reset 双清，结算断言语义不变）。 */
  static get live(): number { return BattleFx.items.length + BattleFx.breaths.size; }

  /** 新战斗/离场重置：driven 节点先逐像素归位（防中途结束残留位移），overlay 全部销毁。
   * A3：淡出/复活遗留的半程透明度一并复位 255（节点通常随 show() 重建，此处兜节点复用场景），
   * deadFaded 状态表清空。A4：呼吸态先退出（缩放归位 + rim 销毁）再清表与寻址上下文。 */
  static reset() {
    for (const f of BattleFx.items) {
      BattleFx.restoreDriven(f);
      if (f.kind === 'deathFade' || f.kind === 'revive') {
        for (const d of f.driven) {
          if (!d.node.isValid) continue;
          const op = d.node.getComponent(UIOpacity);
          if (op) op.opacity = 255;
        }
      }
      if (f.node && f.node.isValid) { f.node.removeFromParent(); f.node.destroy(); }
    }
    BattleFx.items = [];
    for (const uid of Array.from(BattleFx.breaths.keys())) BattleFx.exitBreath(uid);
    BattleFx.breaths.clear();
    BattleFx.view = null;
    BattleFx.deadFaded.clear();
  }

  /** finishBattle 钩子（语义命名便于回读），内部即 reset。 */
  static onBattleEnd() { BattleFx.reset(); }

  /**
   * 每帧把 `step().events` 与一次 `snapshot()` 传入（仅 battle 页调用，防 fx 泄到其他页）。
   * 内部按 snapshot 下标建 uid→节点序号映射：snapshot 数组下标 = 战斗页节点序号 i
   * （drawFighter/refreshBattleView 同一序号，节点名 Fighter{i}）。
   * content 仅用于定位 fxLayer（与 content 同坐标系，overlay 直接 copy 目标节点 position）。
   * A4 起扫序：呼吸状态机（scanEnergy）先于事件——退出呼吸的缩放归位必须发生在同帧事件 fx
   * （deathFade/revive/ultLunge）采样缩放基准之前，否则基准被呼吸值污染（详见 scanEnergy 注释）；
   * 事件块与跨帧扫描块解耦——无事件帧也执行扫描（A3 兜底复活/重绘自愈必须每帧比对 alive）。
   */
  static feed(events: any[], snapshot: any[], ui: CocosUi, content: Node) {
    if (!ui || !content || !snapshot || !snapshot.length) return;
    const indexByUid = new Map<string, number>();
    for (let i = 0; i < snapshot.length; i++) indexByUid.set(snapshot[i].uid, i);
    BattleFx.view = { ui, indexByUid }; // A4：呼吸写在 tick，此处每帧刷新寻址上下文
    // A4 怒气满呼吸状态机（先于事件，理由见方法注释；无槽位竞争——呼吸只写 scale 且为终态权威）。
    BattleFx.scanEnergy(snapshot, ui, indexByUid, content);
    if (events && events.length) {
      const layer = CocosUi.ensureFxLayer(content);
      for (const ev of events) {
        if (!ev) continue;
        if (ev.e === 'hit') {
          BattleFx.spawnDmgNum(layer, ui, ev, indexByUid);
          BattleFx.spawnShake(ui, ev, indexByUid);
        } else if (ev.e === 'ult') {
          BattleFx.spawnUltBanner(layer, ui, ev, indexByUid);
          BattleFx.spawnUltLunge(ui, ev, indexByUid);
        } else if (ev.e === 'act') BattleFx.spawnLunge(ui, ev, indexByUid);
        else if (ev.e === 'death') BattleFx.spawnDeathFade(ui, indexByUid, ev.uid);
        else if (ev.e === 'cheat') BattleFx.spawnRevive(ui, indexByUid, ev.uid); // pct 字段为规则层语义，表现层不消费
      }
    }
    // A3 兜底比对（规格 6.2-5：主触发是 cheat 事件，此处仅安全网）：复活补偿 + 重绘自愈。
    BattleFx.scanAlive(snapshot, ui, indexByUid);
  }

  /**
   * A4：怒气满常驻呼吸状态机（规格 6.4 A4）——`energy>=100 && alive` 进态、<100 或 !alive
   * 退出（Map<uid>，reset 清）。与 A2 一次性版的语义差异：态由 snapshot 状态驱动而非跨阈值
   * 事件——开场/获满即呼吸（大招可用的常驻提示，首帧满怒也成立），castUlt 清怒即退；
   * 不再有”播成功才标记/下帧重试”（呼吸无互斥槽，进态即刻成立；进态守卫仅 hasFadeFx——
   * 复活动画进行中顺延一帧，防基准采样到复活的脉冲中值）。
   */
  private static scanEnergy(snapshot: any[], ui: CocosUi, indexByUid: Map<string, number>, content: Node) {
    for (const u of snapshot) {
      if (!u || !u.uid) continue;
      const e = Number(u.energy);
      const full = u.alive !== false && isFinite(e) && e >= 100;
      const has = BattleFx.breaths.has(u.uid);
      if (full && !has) BattleFx.enterBreath(u.uid, ui, indexByUid, content);
      else if (!full && has) BattleFx.exitBreath(u.uid);
    }
  }

  /** A4 进态：采样缩放基准 + 建两枚预制 rim（Graphics 各画一次）。进态前有 hasFadeFx 守卫
   * （scanEnergy），此处基准必为净值；援军越界等非法坐标跳过（下帧重试，与 A2 重试语义一致）。 */
  private static enterBreath(uid: string, ui: CocosUi, indexByUid: Map<string, number>, content: Node) {
    if (BattleFx.hasFadeFx(uid)) return; // 淡出/复活跃：顺延一帧（防 baseF 采到复活脉冲中值）
    const idx = indexByUid.get(uid);
    if (idx === undefined) return;
    const fighter = ui.node('Fighter' + idx);
    const glyph = ui.node('FighterGlyph' + idx);
    if (!fighter || !fighter.isValid || !glyph || !glyph.isValid) return;
    const fp = fighter.position;
    if (!isFinite(fp.x) || !isFinite(fp.y)) return; // 援军 slot=5 越界守卫（6.2-7）
    let rimGold: Node | null = null, rimHi: Node | null = null;
    const layer = CocosUi.ensureFxLayer(content);
    rimGold = BattleFx.makeRim('BfxRimG', fp.x, fp.y, GOLD);
    rimHi = BattleFx.makeRim('BfxRimH', fp.x, fp.y, GOLD_HI);
    layer.addChild(rimGold);
    layer.addChild(rimHi);
    rimHi.active = false; // 起始相：金框亮
    BattleFx.breaths.set(uid, { t: 0, baseF: fighter.scale.x, baseG: glyph.scale.x, rimGold, rimHi });
  }

  /** A4 预制 rim：卡面 90×91 r13 外扩 RIM_PAD 的圆角描边，只画这一次（态内仅切 active）。 */
  private static makeRim(name: string, x: number, y: number, color: Color): Node {
    const node = new Node(name);
    node.setPosition(new Vec3(x, y, 0));
    node.addComponent(UITransform).setContentSize(90 + RIM_PAD * 2, 91 + RIM_PAD * 2);
    const g = node.addComponent(Graphics);
    g.strokeColor = color;
    g.lineWidth = 3;
    g.roundRect(-45 - RIM_PAD, -45.5 - RIM_PAD, 90 + RIM_PAD * 2, 91 + RIM_PAD * 2, 13 + RIM_PAD);
    g.stroke();
    return node;
  }

  /**
   * A4 退态：缩放逐位归位 + rim 销毁（幂等：不在态内直接返回）。
   * 位置时机敏感：必须先于同帧事件 fx 采样基准（feed 扫序保证），并修正呼吸期间采样的
   * 驱动 fx 基准——shake/lunge 若以呼吸中的缩放为 baseScale，退出后其每帧写/到期归位都会
   * 把呼吸值当基准残留永久 +6% 缩放，统一改写真基准。
   */
  private static exitBreath(uid: string) {
    const st = BattleFx.breaths.get(uid);
    if (!st) return;
    BattleFx.breaths.delete(uid);
    const view = BattleFx.view;
    if (view) {
      const idx = view.indexByUid.get(uid);
      if (idx !== undefined) {
        const f = view.ui.node('Fighter' + idx), g = view.ui.node('FighterGlyph' + idx);
        if (f && f.isValid) f.setScale(new Vec3(st.baseF, st.baseF, 1));
        if (g && g.isValid) g.setScale(new Vec3(st.baseG, st.baseG, 1));
      }
    }
    for (const f of BattleFx.items) {
      if ((f.kind === 'shake' || f.kind === 'lunge' || f.kind === 'ultLunge') && f.data.uid === uid) {
        if (f.driven[0]) f.driven[0].baseScale = st.baseF;
        if (f.driven[1]) f.driven[1].baseScale = st.baseG;
      }
    }
    if (st.rimGold && st.rimGold.isValid) { st.rimGold.removeFromParent(); st.rimGold.destroy(); }
    if (st.rimHi && st.rimHi.isValid) { st.rimHi.removeFromParent(); st.rimHi.destroy(); }
  }

  /** 帧率无关驱动：elapsed += dt * speed（×4 时动画同步加快，对齐 popupLife/refreshGap 除速惯例）。 */
  static tick(dt: number, speed: number) {
    const advance = dt * (speed || 1);
    for (let i = BattleFx.items.length - 1; i >= 0; i--) {
      const f = BattleFx.items[i];
      if (f.kind === 'shake' || f.kind === 'lunge' || f.kind === 'ultLunge'
        || f.kind === 'deathFade' || f.kind === 'revive') {
        // 驱动型：任一被驱动节点失效（show() 整页重绘销毁）→ 归位剩余有效节点并弃单
        if (f.driven.some(d => !d.node.isValid)) { BattleFx.restoreDriven(f); BattleFx.items.splice(i, 1); continue; }
        f.elapsed += advance;
        const t = Math.min(1, f.elapsed / f.duration);
        let dx = 0, dy = 0, ds = 0;
        if (f.kind === 'shake') {
          dx = SHAKE_AMP * Math.sin(2 * Math.PI * SHAKE_CYCLES * t);
        } else if (f.kind === 'lunge' || f.kind === 'ultLunge') {
          // lunge 族：快出（easeOut 冲到满幅）慢回（easeInOut 归零），终帧 off=0 与 base 逐像素一致
          const dist = f.kind === 'lunge' ? LUNGE_DIST : ULT_LUNGE_DIST;
          const out = f.kind === 'lunge' ? LUNGE_OUT : ULT_LUNGE_OUT;
          dy = (f.data.dir || 1) * BattleFx.lungeOffset(f.elapsed, dist, f.duration, out);
        } else if (f.kind === 'deathFade') {
          // A3 阵亡淡出：下沉 10px easeIn（缓慢启动的瘫沉感），终帧位置由 restoreDriven 归 base
          dy = -DEATH_SINK * t * t;
        } else {
          // A3 复活：从下沉位回 0（easeOut 先快后缓的起身感；无前置淡出时不位移）+ 复活脉冲
          dy = f.data.sunk ? -DEATH_SINK * (1 - BattleFx.easeOutQuad(t)) : 0;
          ds = PULSE_AMP * Math.sin(Math.PI * t);
        }
        for (const d of f.driven) {
          d.node.setPosition(new Vec3(d.baseX + dx, d.baseY + dy, 0));
          d.node.setScale(d.baseScale + ds, d.baseScale + ds, 1);
          if (d.op) {
            d.op.opacity = f.kind === 'deathFade'
              ? Math.max(0, Math.floor(d.fromOp * (1 - t * t))) // easeIn 淡出至 0（终帧恰为 0 = 透明终态）
              : Math.min(255, Math.round(d.fromOp + (255 - d.fromOp) * BattleFx.easeOutQuad(t))); // easeOut 回升至满
          }
        }
        if (t >= 1) { BattleFx.restoreDriven(f); BattleFx.items.splice(i, 1); }
        continue;
      }
      if (!f.node || !f.node.isValid) { BattleFx.items.splice(i, 1); continue; }
      f.elapsed += advance;
      const t = Math.min(1, f.elapsed / f.duration);
      if (f.kind === 'dmgNum') {
        f.node.setPosition(new Vec3(f.data.baseX, f.data.baseY - DMG_RISE * t, 0));
        if (f.data.pop) {
          // A5 暴击弹跳：0.18s 内 scale 1.6→1（easeOut 减速收拢），终帧恰为 1 无残留；
          // 普通伤害数字不写缩放（规格"普通字不变"）。overlay 随到期销毁，无需归位钩子。
          const popT = Math.min(1, f.elapsed / DMG_POP);
          const s = DMG_POP_FROM - (DMG_POP_FROM - 1) * BattleFx.easeOutQuad(popT);
          f.node.setScale(new Vec3(s, s, 1));
        }
        if (f.opacity) f.opacity.opacity = Math.max(0, Math.floor(255 * (1 - t)));
      } else { // ultBanner：A4 入场滑入（y+14→0，90ms easeOut 自上落入）+ 亮金描边叠加层衰减（加亮后回落金框）；
        // 之后前 0.9s 全亮，末 0.3s 淡出（现状 230→0 参数换算为节点透明度）
        const slide = Math.min(1, f.elapsed / BANNER_SLIDE);
        f.node.setPosition(new Vec3(f.data.baseX, f.data.baseY + BANNER_SLIDE_DIST * (1 - BattleFx.easeOutQuad(slide)), 0));
        if (f.opacity) {
          f.opacity.opacity = f.elapsed < 0.9 ? 255
            : Math.max(0, Math.floor(255 * (f.duration - f.elapsed) / (f.duration - 0.9)));
        }
        if (f.glowOp) {
          f.glowOp.opacity = Math.max(0, Math.round(255 * (1 - BattleFx.easeOutQuad(Math.min(1, f.elapsed / BANNER_GLOW)))));
        }
      }
      if (t >= 1) {
        f.node.removeFromParent();
        f.node.destroy();
        BattleFx.items.splice(i, 1);
      }
    }
    // A4 怒气满常驻呼吸：每帧对态内单位重写缩放（tick 最后写 = 终态权威，正交于只写位移的
    // lunge/shake）并按 3Hz 切 rim visible（Graphics 已预制，零逐帧重绘）。节点按 view 每帧
    // 重新解析——整页重绘重建后自愈，无需 deadFaded 式状态机。
    if (BattleFx.breaths.size && BattleFx.view) {
      for (const [uid, st] of BattleFx.breaths) {
        st.t += advance;
        const idx = BattleFx.view.indexByUid.get(uid);
        if (idx === undefined) continue;
        const f = BattleFx.view.ui.node('Fighter' + idx), g = BattleFx.view.ui.node('FighterGlyph' + idx);
        const off = BREATH_AMP * Math.sin(BREATH_RATE * st.t);
        if (f && f.isValid && isFinite(f.position.x)) f.setScale(new Vec3(st.baseF + off, st.baseF + off, 1));
        if (g && g.isValid) g.setScale(new Vec3(st.baseG + off, st.baseG + off, 1));
        const hi = Math.floor(st.t * RIM_HZ) % 2 === 1;
        if (st.rimGold && st.rimGold.isValid) st.rimGold.active = !hi;
        if (st.rimHi && st.rimHi.isValid) st.rimHi.active = hi;
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

  /** 驱动型寻址：Fighter+Glyph 成对取（6.2-7：一个单位=多个兄弟节点，动效必须同动）。
   * ensureOp=true（A3 淡出/复活）：补挂缺失的 UIOpacity（drawFighter 不建该组件）并快照当前
   * 透明度作 fromOp；四类动效只读坐标/缩放，不触碰透明度（op 为既有组件或 null）。 */
  private static drivenOf(indexByUid: Map<string, number>, ui: CocosUi, uid: string, ensureOp = false): DrivenNode[] | null {
    const idx = indexByUid.get(uid);
    if (idx === undefined) return null;
    const fighter = ui.node('Fighter' + idx);
    const glyph = ui.node('FighterGlyph' + idx);
    if (!fighter || !fighter.isValid || !glyph || !glyph.isValid) return null;
    const fp = fighter.position, gp = glyph.position;
    if (!isFinite(fp.x) || !isFinite(fp.y) || !isFinite(gp.x) || !isFinite(gp.y)) return null;
    const fo = ensureOp ? BattleFx.ensureOpacity(fighter) : fighter.getComponent(UIOpacity);
    const go = ensureOp ? BattleFx.ensureOpacity(glyph) : glyph.getComponent(UIOpacity);
    return [
      { node: fighter, baseX: fp.x, baseY: fp.y, baseScale: fighter.scale.x, op: fo, fromOp: fo ? fo.opacity : 255 },
      { node: glyph, baseX: gp.x, baseY: gp.y, baseScale: glyph.scale.x, op: go, fromOp: go ? go.opacity : 255 },
    ];
  }

  /** A3：取/补挂节点 UIOpacity（淡出/复活需要透明度主写权）。 */
  private static ensureOpacity(n: Node): UIOpacity {
    let c = n.getComponent(UIOpacity);
    if (!c) c = n.addComponent(UIOpacity);
    return c;
  }

  private static restoreDriven(f: BfxItem) {
    for (const d of f.driven) {
      if (!d.node.isValid) continue;
      d.node.setPosition(new Vec3(d.baseX, d.baseY, 0));
      d.node.setScale(d.baseScale, d.baseScale, 1);
    }
  }

  /** A3：终结某 uid 的淡出/复活 fx（同 uid 后到者接管；只归位坐标/缩放，透明度留给接管方按当前值续播，防跳变）。 */
  private static killFadeFx(uid: string) {
    for (let i = BattleFx.items.length - 1; i >= 0; i--) {
      const f = BattleFx.items[i];
      if ((f.kind === 'deathFade' || f.kind === 'revive') && f.data.uid === uid) {
        BattleFx.restoreDriven(f);
        BattleFx.items.splice(i, 1);
      }
    }
  }

  /** A3/A4：终结某 uid 的三类驱动 fx 并归位，同时退出呼吸态（缩放归位 + rim 销毁）——
   * 淡出/复活 spawn 时取得位移/缩放主写权，base 采样必须发生在归位之后
   * （否则会把动效/呼吸中的位置与缩放误当基准，残留永久偏移）。 */
  private static killDrivenFx(uid: string) {
    BattleFx.exitBreath(uid);
    for (let i = BattleFx.items.length - 1; i >= 0; i--) {
      const f = BattleFx.items[i];
      if ((f.kind === 'shake' || f.kind === 'lunge' || f.kind === 'ultLunge')
        && f.data.uid === uid) {
        BattleFx.restoreDriven(f);
        BattleFx.items.splice(i, 1);
      }
    }
  }

  /** A3：某 uid 是否有淡出/复活 fx 活跃（活跃期间四类驱动让位，见 spawnDeathFade 注释）。 */
  private static hasFadeFx(uid: string): boolean {
    for (const f of BattleFx.items) {
      if ((f.kind === 'deathFade' || f.kind === 'revive') && f.data.uid === uid) return true;
    }
    return false;
  }

  /** A3：直接设置某单位 Fighter+Glyph 透明度（ensure 补挂 UIOpacity——整页重绘后的新节点无组件）。 */
  private static setFadeOpacity(ui: CocosUi, indexByUid: Map<string, number>, uid: string, value: number, ensure = false) {
    const idx = indexByUid.get(uid);
    if (idx === undefined) return;
    for (const name of ['Fighter' + idx, 'FighterGlyph' + idx]) {
      const node = ui.node(name);
      if (!node || !node.isValid) continue;
      let op = node.getComponent(UIOpacity);
      if (!op && ensure) op = node.addComponent(UIOpacity);
      if (op && op.opacity !== value) op.opacity = value;
    }
  }

  /**
   * A3 兜底扫描（每帧，代价 ≤场上单位数次 Map 查询；主触发是 cheat 事件，本函数是安全网）：
   * - deadFaded 单位 snapshot.alive 回 true（cheat 事件缺席的复活路径）→ 终结残留淡出 fx 并
   *   立即恢复可见（无动画，规格 6.1 兜底语义），防"幽灵位"。
   * - deadFaded 单位仍 dead 但淡出 fx 已不在（战斗中整页重绘重建节点、UIOpacity 丢失）→
   *   静默重挂透明终态；已有终态（opacity 已 0）则零写入。
   */
  private static scanAlive(snapshot: any[], ui: CocosUi, indexByUid: Map<string, number>) {
    for (const u of snapshot) {
      if (!u || !u.uid || !BattleFx.deadFaded.has(u.uid)) continue;
      if (u.alive !== false) {
        BattleFx.killFadeFx(u.uid);
        BattleFx.setFadeOpacity(ui, indexByUid, u.uid, 255);
        BattleFx.deadFaded.delete(u.uid);
      } else if (!BattleFx.hasFadeFx(u.uid)) {
        BattleFx.setFadeOpacity(ui, indexByUid, u.uid, 0, true);
      }
    }
  }

  /** 同 uid 已有驱动型 fx（lunge/ultLunge/shake 互斥共写同一节点坐标/缩放基准），新动效让位。
   * A4 呼吸态不在此列：呼吸只写 scale（每帧终态权威），驱动型实际只消费位移，两者正交。 */
  private static hasDrivenFx(uid: string): boolean {
    for (const f of BattleFx.items) {
      if ((f.kind === 'shake' || f.kind === 'lunge' || f.kind === 'ultLunge')
        && f.data.uid === uid) return true;
    }
    return false;
  }

  private static countKind(kind: BfxItem['kind']): number {
    let n = 0;
    for (const f of BattleFx.items) if (f.kind === kind) n++;
    return n;
  }

  private static easeOutQuad(u: number): number { return 1 - (1 - u) * (1 - u); }
  private static easeInOutQuad(u: number): number { return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; }

  /** lunge 族位移包络：out 段 easeOut 冲到满幅，余段 easeInOut 归零（终帧恰为 0）。 */
  private static lungeOffset(elapsed: number, dist: number, dur: number, out: number): number {
    return elapsed <= out
      ? dist * BattleFx.easeOutQuad(elapsed / out)
      : dist * (1 - BattleFx.easeInOutQuad(Math.min(1, (elapsed - out) / (dur - out))));
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
    if (crit) node.setScale(new Vec3(DMG_POP_FROM, DMG_POP_FROM, 1)); // A5 暴击弹跳首帧
    const opacity = node.addComponent(UIOpacity);
    BattleFx.items.push({ kind: 'dmgNum', node, driven: [], opacity, glowOp: null, elapsed: 0, duration: DMG_LIFE, data: { baseX, baseY, pop: crit } });
  }

  /**
   * 大招横幅（ult 事件）：施放者头顶（pos+(0,-80)），260×42 金框，1.2s 淡出。
   * A4 入场增强：亮金描边叠加层（子节点，同几何加粗一档）随滑入自 255 衰减至 0——
   * "描边加亮后回落金框"；Graphics 各画一次，动画全走 UIOpacity/位置，零逐帧重绘。
   */
  private static spawnUltBanner(layer: Node, ui: CocosUi, ev: any, indexByUid: Map<string, number>) {
    const anchor = BattleFx.anchorOf(indexByUid, ui, ev.uid);
    if (!anchor) return;
    const node = new Node('BfxUlt');
    const baseX = anchor.x;
    const baseY = anchor.y - 80;
    node.setPosition(new Vec3(baseX, baseY + BANNER_SLIDE_DIST, 0)); // 滑入起点：终位上方 14px
    node.addComponent(UITransform).setContentSize(260, 42);
    const g = node.addComponent(Graphics);
    g.fillColor = new Color(46, 26, 12, 230);
    g.roundRect(-130, -21, 260, 42, 6);
    g.fill();
    g.strokeColor = GOLD;
    g.lineWidth = 2;
    g.roundRect(-129, -20, 258, 40, 6);
    g.stroke();
    const glow = new Node('BfxUltGlow');
    glow.addComponent(UITransform).setContentSize(260, 42);
    const gg = glow.addComponent(Graphics);
    gg.strokeColor = GOLD_HI;
    gg.lineWidth = 3.5;
    gg.roundRect(-129, -20, 258, 40, 6);
    gg.stroke();
    node.addChild(glow);
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
    const glowOp = glow.addComponent(UIOpacity);
    BattleFx.items.push({ kind: 'ultBanner', node, driven: [], opacity, glowOp, elapsed: 0, duration: ULT_LIFE, data: { baseX, baseY } });
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
    if (BattleFx.hasFadeFx(ev.uid)) return;   // A3：淡出/复活活跃期间让位（位移主写权在淡出侧）
    const driven = BattleFx.drivenOf(indexByUid, ui, ev.uid);
    if (!driven) return;
    BattleFx.items.push({
      kind: 'shake', node: null, driven, opacity: null, glowOp: null, elapsed: 0, duration: SHAKE_DUR,
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
    if (BattleFx.hasFadeFx(ev.uid)) return;   // A3：淡出/复活活跃期间让位（死亡单位不再 act，理论兜底）
    const driven = BattleFx.drivenOf(indexByUid, ui, ev.uid);
    if (!driven) return;
    const dir = driven[0].baseY < 0 ? 1 : -1; // A 方（下方）+y、B 方（上方）-y
    BattleFx.items.push({
      kind: 'lunge', node: null, driven, opacity: null, glowOp: null, elapsed: 0, duration: LUNGE_DUR,
      data: { baseX: driven[0].baseX, baseY: driven[0].baseY, dir, uid: ev.uid },
    });
  }

  /**
   * 大招前冲（A2）：ult 事件驱施放者 Fighter+Glyph 沿纵轴冲 18px 回弹（0.5s，比普通 lunge
   * 更大更慢，配合金框横幅构成释放仪式感）。与 lunge/shake 共用驱动型互斥槽：施放瞬间同 uid
   * 有活跃动效则让位（横幅仍在，主反馈不丢）；castUlt 与行动回合错帧，实际几乎必播。
   */
  private static spawnUltLunge(ui: CocosUi, ev: any, indexByUid: Map<string, number>) {
    if (BattleFx.countKind('ultLunge') >= MAX_DRIVEN) return;
    if (BattleFx.hasDrivenFx(ev.uid)) return;
    if (BattleFx.hasFadeFx(ev.uid)) return; // A3：淡出/复活活跃期间让位
    const driven = BattleFx.drivenOf(indexByUid, ui, ev.uid);
    if (!driven) return;
    const dir = driven[0].baseY < 0 ? 1 : -1; // 同 lunge：朝敌方阵营方向冲
    BattleFx.items.push({
      kind: 'ultLunge', node: null, driven, opacity: null, glowOp: null, elapsed: 0, duration: ULT_LUNGE_DUR,
      data: { baseX: driven[0].baseX, baseY: driven[0].baseY, dir, uid: ev.uid },
    });
  }

  /**
   * A3 阵亡淡出（death 事件）：Fighter+Glyph opacity 255→0（easeIn）+ 下沉 10px，0.5s；
   * 到期位置归 base、透明度保持 0 = 透明终态（名字/血/怒条照常由 refreshBattleView 渲染，
   * 卡面消失即阵亡反馈）。deadFaded 状态表随 spawn 置入（供兜底复活/重绘自愈）。
   * 守卫：援军越界等非法坐标（drivenOf null）整帧跳过且不入状态表；同 uid 淡出/复活互斥
   * （先终结再播）；spawn 前终结四类驱动 fx（归位后采样，防把动效位置误当基准）。
   */
  private static spawnDeathFade(ui: CocosUi, indexByUid: Map<string, number>, uid: string) {
    if (BattleFx.countKind('deathFade') >= MAX_DRIVEN) return;
    BattleFx.killFadeFx(uid);
    BattleFx.killDrivenFx(uid);
    const driven = BattleFx.drivenOf(indexByUid, ui, uid, true);
    if (!driven) return;
    BattleFx.deadFaded.set(uid, true);
    BattleFx.items.push({
      kind: 'deathFade', node: null, driven, opacity: null, glowOp: null, elapsed: 0, duration: DEATH_DUR,
      data: { baseX: driven[0].baseX, baseY: driven[0].baseY, uid },
    });
  }

  /**
   * A3 复活表现（cheat{uid,pct} 事件，规格 6.2-5：复活主触发）：0.6s 内 opacity 当前值→255
   * （easeOut）+ y 从下沉位回 0 + 一次 1→1.08→1 脉冲；有淡出 fx 在跑/已定格透明 → 先终结
   * 淡出再从透明态完整回升（sunk=true：opacity 0 起、y -10 起）。
   * battle.js handleDeath 的 cheat 分支先于 death 返回：赵云系首次致死只发 cheat、单位始终
   * 直立（无前置淡出）→ sunk=false 起播，等效一次站立脉冲，不做"闪隐再浮现"的假动画。
   */
  private static spawnRevive(ui: CocosUi, indexByUid: Map<string, number>, uid: string) {
    if (BattleFx.countKind('revive') >= MAX_DRIVEN) return;
    const wasFaded = BattleFx.deadFaded.has(uid);
    BattleFx.deadFaded.delete(uid); // 复活即出终态：scanAlive 不再对其兜底/自愈
    BattleFx.killFadeFx(uid);
    BattleFx.killDrivenFx(uid);
    const driven = BattleFx.drivenOf(indexByUid, ui, uid, true);
    if (!driven) return;
    BattleFx.items.push({
      kind: 'revive', node: null, driven, opacity: null, glowOp: null, elapsed: 0, duration: REVIVE_DUR,
      data: { baseX: driven[0].baseX, baseY: driven[0].baseY, uid, sunk: wasFaded },
    });
  }
}
