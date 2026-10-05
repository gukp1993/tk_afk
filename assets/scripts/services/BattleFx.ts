import { Color, Graphics, Label, LabelOutline, Node, UIOpacity, UITransform, Vec3, view } from 'cc';
import { CocosUi, hexColor } from '../ui/CocosUi';
import * as heroData from '../domain/heroes';

/**
 * A0~A5 战斗表现层管线（三线打磨 A 线，纯表现层、零规则改动）：
 * 每帧消费 `fighting.step().events` 与一次 `snapshot()`，生成/驱动八类 fx：
 * - dmgNum：伤害数字（hit）——overlay，挂 fxLayer；A5 暴击弹跳：crit 字首帧 scale 1.6，
 *   0.18s easeOut 收拢至 1（普通字不写缩放、样式分级照旧橙 32/淡黄 24）。
 * - ultBanner：大招横幅（ult）——overlay，挂 fxLayer；A4 入场增强：自上 14px 滑入
 *   （90ms easeOut）+ 亮金描边叠加层自 255 衰减（描边加亮后回落金框），1.2s 淡出照旧。
 * - lunge：攻击位移（act）——驱动既有 `Fighter{i}`+`FighterGlyph{i}` 朝事件目标突进回弹；
 *   近战明显前压，远程角色原地起手并以箭矢/术法弹道命中目标。
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
 *   下沉 10px（0.5s），到期归位为可辨残位（位置回 base、透明度保持 DEATH_FINAL_OP=140）；名字/血/怒条照常由
 *   refreshBattleView 渲染（卡面消失即"阵亡"反馈）。跨帧状态表 deadFaded 记录透明终态：
 *   ①cheat 事件缺席时 snapshot.alive 回 true → 立即恢复可见（兜底复活，规格 6.2-5）；
 *   ②战斗中整页重绘重建节点（UIOpacity 丢失）→ 静默重挂透明态，防"幽灵复现"。
 * - revive（A3）：复活表现（cheat{uid,pct}，6.2-5：复活主触发是 cheat 事件而非轮询）——
 *   0.6s 内 opacity 当前值→255（easeOut）+ y 从下沉位回 0 + 一次 1→1.08→1 脉冲；有淡出
 *   fx 在跑先终结再播。注意 battle.js 的 handleDeath 里 cheat 分支先于 death 返回：赵云系
 *   首次致死只发 cheat、单位始终直立（无前置淡出）→ 从当前状态起播等效一次站立脉冲；
 *   "淡出中/已定格再被复活"的完整回升链路作为防御路径保留（规格 6.4 A3 的幽灵位防线）。
 * 由 `Bootstrap.update` 战斗分支驱动 `feed → tick(dt, speed)`，帧率无关（对齐 CocosUi.floaters 模式）。
 * 追加原生技能光效：按 cls/faction 区分刀光、箭矢、法术/通用脉冲，大招分蓄力/释放/命中；
 * 独立 lights 只读卡面锚点，沿真实事件受体驱动，有限数量/短寿命，同步倍速并纳入 live/reset。
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
 *   （deathFade 到期例外：位置归 base、透明度保持 DEATH_FINAL_OP = 可辨残位）。
 */

const GOLD = hexColor('#e3ba70'); // 现状 UltPopup 金框/金字
const GOLD_HI = hexColor('#ffe9b0'); // A4 亮金：呼吸 rim 交替的第二色 + 横幅入场描边加亮
const DMG_LIFE = 0.8;             // 伤害数字寿命秒（现状 800ms；×N 倍速由 tick 按 speed 压缩）
const DMG_RISE = 60;              // 上飘距离（现状线性 60px）
const ULT_LIFE = 1.2;             // 横幅寿命（前 0.9s 全亮 230，末 0.3s 淡出）
const MAX_DMG_NUM = 24;           // 同屏伤害数字上限（规格 6.3 预算）
const SHAKE_AMP = 8;              // 全身立绘受击回弹幅度，较旧方卡更易读。
const SHAKE_CYCLES = 3;           // 0.18s 内三次全振荡（sin 起点/终点均为 0，天然归位）
const SHAKE_DUR = 0.18;
const LUNGE_DIST = 64;            // 近战朝真实目标突进；远程只做短促起手。
const LUNGE_DUR = 0.42;
const LUNGE_OUT = 0.15;
const ULT_LUNGE_DIST = 18;        // A2 大招前冲：比普通 lunge 更大更慢，更有仪式感
const ULT_LUNGE_DUR = 0.5;        // 0.18s easeOut 冲出 + 0.32s easeInOut 回弹（无过冲，终帧零偏移）
const ULT_LUNGE_OUT = 0.18;
const BREATH_AMP = 0.06;          // A4 呼吸幅度：scale=基准+0.06·sin(t·6)（规格字面）
const BREATH_RATE = 6;            // A4 呼吸角频率 rad/s（≈0.96Hz）
const RIM_HZ = 3;                 // A4 双 rim visible 交替频率（金↔亮金）
const RIM_PAD = 5;                // A4 呼吸光环相对全身立绘的外扩距离
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
// 原生技能光效：最多 4 大招、8 普攻，每序列最多 11 节点（含根），只在生成时绘制 Graphics。
const MAX_SKILL_FX = 4;
const MAX_ATTACK_FX = 8;
const SKILL_CHARGE = 0.20;
const SKILL_RELEASE = 0.28;
const SKILL_IMPACT = 0.32;
const ATTACK_RELEASE = 0.18;
const ATTACK_IMPACT = 0.16;
const ULT_SCENE_LIFE = 0.9;
const MAX_ULT_SCENE_QUEUE = 2;
const ULT_SCENE_FIELD_TOP = 535;
const ULT_SCENE_FIELD_BOTTOM = -520;

type UltimateMotif = 'blossom'|'dragon'|'shock'|'multi'|'bagua'|'arrow'|'command'|'eclipse'|'crossed'|'charge'|'wave'|'spear'|'firegrid'|'halberd'|'dance'|'vortex';
interface UltimateSceneSpec { uid: string; heroId: string; name: string; faction: string; skill: string }
interface UltimateSceneFx { root: Node; motif: Node; elapsed: number; spec: UltimateSceneSpec }
interface UltimateTheme { motif: UltimateMotif; primary: Color; accent: Color }
const ULTIMATE_THEMES: Record<string, UltimateTheme> = {
  liubei: { motif:'blossom', primary:hexColor('#73c9a2'), accent:hexColor('#f3cf79') },
  guanyu: { motif:'dragon', primary:hexColor('#4cc2b4'), accent:hexColor('#e7d28b') },
  zhangfei: { motif:'shock', primary:hexColor('#dc6b50'), accent:hexColor('#f5c36c') },
  zhaoyun: { motif:'multi', primary:hexColor('#a8d5e7'), accent:hexColor('#eaf5ff') },
  zhugeliang: { motif:'bagua', primary:hexColor('#54cbb5'), accent:hexColor('#f4d77f') },
  huangzhong: { motif:'arrow', primary:hexColor('#efbe56'), accent:hexColor('#fff0ae') },
  caocao: { motif:'command', primary:hexColor('#d0a657'), accent:hexColor('#efe0b2') },
  simayi: { motif:'eclipse', primary:hexColor('#7897db'), accent:hexColor('#bdc7ed') },
  dianwei: { motif:'crossed', primary:hexColor('#ce8054'), accent:hexColor('#f0cd8b') },
  zhangliao: { motif:'charge', primary:hexColor('#e0a94d'), accent:hexColor('#fff0bd') },
  zhouyu: { motif:'wave', primary:hexColor('#ef7845'), accent:hexColor('#ffd16c') },
  sunce: { motif:'spear', primary:hexColor('#d84f3d'), accent:hexColor('#f7cd77') },
  luxun: { motif:'firegrid', primary:hexColor('#ee7440'), accent:hexColor('#ffd76d') },
  lvbu: { motif:'halberd', primary:hexColor('#bd5e70'), accent:hexColor('#f3c86f') },
  diaochan: { motif:'dance', primary:hexColor('#cf8ecb'), accent:hexColor('#f5d9ec') },
  dongzhuo: { motif:'vortex', primary:hexColor('#ba5847'), accent:hexColor('#d6a447') },
};

type SkillStyle = 'melee' | 'ranged' | 'magic' | 'pulse';
interface LightPart { node: Node; op: UIOpacity }
interface LightTarget {
  anchor: Node;
  release: LightPart;
  impact: LightPart;
  spark: LightPart | null;
}
interface SkillLight {
  root: Node;
  uid: string;
  source: Node;
  style: SkillStyle;
  ultimate: boolean;
  elapsed: number;
  charge: LightPart | null;
  targets: LightTarget[];
}
interface PendingNumber {
  light: SkillLight;
  elapsed: number;
  delay: number;
  ev: { e: string; uid: string; src?: string; amount: number; crit?: boolean; kind?: string };
  recipient: Node;
  layer: Node;
  ui: CocosUi;
  indexByUid: Map<string, number>;
}

/** 被驱动的既有节点 + 归位基准（Fighter 地面阴影锚点与 Glyph 立绘中心分别保存）。
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
  data: { baseX: number; baseY: number; dir?: number; dirX?: number; dirY?: number; dist?: number; uid?: string; sunk?: boolean; pop?: boolean };
}

/** A4 怒气满常驻呼吸态：uid → 态（进态建、退出/reset 销毁）。rim 两枚 Graphics 各画一次，
 * 态内只切 active（3Hz 交替），不逐帧重绘。baseF/baseG 为进态时的缩放基准（进态有
 * hasFadeFx 守卫，采样时节点必为净基准），退出时逐位归位。 */
interface BreathState { t: number; baseF: number; baseG: number; rimGold: Node | null; rimHi: Node | null }

export class BattleFx {
  private static items: BfxItem[] = [];
  /** 与既有八类动效分开驱动，只读单位节点、不接管卡面坐标/缩放/透明度。 */
  private static lights: SkillLight[] = [];
  /** SSR专属全场大招演出：只允许一场覆盖战场，最多排两场以避免同帧大招互相盖住。 */
  private static ultimateScene: UltimateSceneFx | null = null;
  private static ultimateSceneQueue: UltimateSceneSpec[] = [];
  /** 纯表现队列：大招数字到命中段才播，血量/效果在规则层仍即时结算。 */
  private static pendingNumbers: PendingNumber[] = [];
  /** A4 怒气呼吸跨帧状态：uid → 常驻呼吸态（feed 按 snapshot 状态机进出；reset 清，跨场不残留）。 */
  private static breaths = new Map<string, BreathState>();
  /** A4：最近一帧 feed 的寻址上下文（呼吸写在 tick，需按 uid 解析节点；每帧刷新，
   * reset 置空——feed 只在 battle 页调用，离开即失效）。 */
  private static view: { ui: CocosUi; indexByUid: Map<string, number>; content: Node } | null = null;
  /** A3 阵亡淡出跨帧状态：uid → 已进入/正在进入透明终态（death 事件置入，cheat/兜底复活
   * 移除；reset 清，跨场不残留）。供 snapshot.alive 兜底比对与重绘自愈。 */
  private static deadFaded = new Map<string, true>();
  /** R8：阵亡淡出终态透明度——35% 残留可辨（此前 0 深底下只剩名字不可辨） */
  private static readonly DEATH_FINAL_OP = 140;

  /** 现存 fx 数（__tkDiag().fx 机检：跨场残留断言用）。A4 起计入呼吸态（rim overlay 不入
   * items，泄漏时 fx 仍须非 0 才能被机检捕获；reset 双清，结算断言语义不变）。 */
  static get live(): number {
    return BattleFx.items.length + BattleFx.breaths.size + BattleFx.lights.length + BattleFx.pendingNumbers.length
      + (BattleFx.ultimateScene ? 1 : 0) + BattleFx.ultimateSceneQueue.length;
  }

  static get ultimateScenesLive() { return (BattleFx.ultimateScene ? 1 : 0) + BattleFx.ultimateSceneQueue.length; }
  /** Pending result transition budget: active scene plus the bounded two-scene queue. */
  static get ultimateSceneMaxTail() { return ULT_SCENE_LIFE * (MAX_ULT_SCENE_QUEUE + 1) + 0.15; }

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
    BattleFx.destroyUltimateScene();
    BattleFx.ultimateSceneQueue = [];
    for (const light of BattleFx.lights) BattleFx.destroyLight(light);
    BattleFx.lights = [];
    BattleFx.pendingNumbers = [];
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
    BattleFx.view = { ui, indexByUid, content }; // A4：呼吸写在 tick，此处每帧刷新寻址上下文
    // A4 怒气满呼吸状态机（先于事件，理由见方法注释；无槽位竞争——呼吸只写 scale 且为终态权威）。
    BattleFx.scanEnergy(snapshot, ui, indexByUid, content);
    if (events && events.length) {
      const layer = CocosUi.ensureFxLayer(content);
      const ultLights = new Map<string, SkillLight>();
      for (let eventIndex = 0; eventIndex < events.length; eventIndex++) {
        const ev = events[eventIndex];
        if (!ev) continue;
        const castLight = ev.cast ? ultLights.get(ev.cast) : null;
        if (ev.e === 'hit') {
          if (castLight) {
            BattleFx.queueNumber(castLight, layer, ui, ev, indexByUid);
          } else {
            BattleFx.spawnDmgNum(layer, ui, ev, indexByUid);
            BattleFx.spawnShake(ui, ev, indexByUid);
          }
        } else if (ev.e === 'heal') {
          if (castLight) {
            BattleFx.queueNumber(castLight, layer, ui, ev, indexByUid);
          } else BattleFx.spawnDmgNum(layer, ui, ev, indexByUid);
        } else if (ev.e === 'ult') {
          const caster = snapshot[indexByUid.get(ev.uid)!];
          const definition = caster && caster.heroId ? heroData.getHero(caster.heroId) : null;
          if (caster && definition && definition.rarity === 4) {
            BattleFx.queueUltimateScene(CocosUi.ensureBattleSceneLayer(content, ui.node('BattleHeader')), {
              uid: ev.uid, heroId: caster.heroId, name: caster.name || '', faction: caster.faction || '', skill: String(ev.skill || '')
            });
          }
          const light = BattleFx.spawnLight(layer, ui, indexByUid, snapshot, ev.uid,
            BattleFx.ultTargets(events, eventIndex, ev.uid), true);
          if (light) ultLights.set(ev.uid, light);
          BattleFx.spawnUltBanner(layer, ui, { ...ev, caster: snapshot[indexByUid.get(ev.uid)!]?.name }, indexByUid);
          BattleFx.spawnUltLunge(ui, ev, indexByUid);
        } else if (ev.e === 'act') {
          if (ev.type === 'atk' && ev.tgt) BattleFx.spawnLight(layer, ui, indexByUid, snapshot, ev.uid, [ev.tgt], false);
          BattleFx.spawnLunge(ui, ev, indexByUid, snapshot);
        } else if (ev.e === 'death') {
          BattleFx.cancelUltimateScene(ev.uid);
          BattleFx.cancelPendingNumbers(ev.uid);
          BattleFx.cancelCharge(ev.uid);
          BattleFx.spawnDeathFade(ui, indexByUid, ev.uid);
        }
        else if (ev.e === 'cheat') {
          BattleFx.cancelPendingNumbers(ev.uid);
          BattleFx.spawnRevive(ui, indexByUid, ev.uid); // pct 字段为规则层语义，表现层不消费
        }
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
    const fp = glyph.position;
    if (!isFinite(fp.x) || !isFinite(fp.y)) return; // 援军 slot=5 越界守卫（6.2-7）
    const size=glyph.getComponent(UITransform)?.contentSize;
    const w=size?.width||112,h=size?.height||146;
    let rimGold: Node | null = null, rimHi: Node | null = null;
    const layer = CocosUi.ensureFxLayer(content);
    rimGold = BattleFx.makeRim('BfxRimG', fp.x, fp.y, w, h, GOLD);
    rimHi = BattleFx.makeRim('BfxRimH', fp.x, fp.y, w, h, GOLD_HI);
    layer.addChild(rimGold);
    layer.addChild(rimHi);
    rimHi.active = false; // 起始相：金框亮
    BattleFx.breaths.set(uid, { t: 0, baseF: fighter.scale.x, baseG: glyph.scale.x, rimGold, rimHi });
  }

  /** A4 预制光环：围绕全身立绘绘制椭圆描边，只画这一次（态内仅切 active）。 */
  private static makeRim(name: string, x: number, y: number, w: number, h: number, color: Color): Node {
    const node = new Node(name);
    node.setPosition(new Vec3(x, y, 0));
    node.addComponent(UITransform).setContentSize(w + RIM_PAD * 2, h + RIM_PAD * 2);
    const g = node.addComponent(Graphics);
    g.strokeColor = color;
    g.lineWidth = 3;
    g.ellipse(0,-h*0.08,w*0.48+RIM_PAD,h*0.56+RIM_PAD);
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
          const dist = f.kind === 'lunge' ? (f.data.dist || LUNGE_DIST) : ULT_LUNGE_DIST;
          const out = f.kind === 'lunge' ? LUNGE_OUT : ULT_LUNGE_OUT;
          const travel = BattleFx.lungeOffset(f.elapsed, dist, f.duration, out);
          dx = (f.data.dirX || 0) * travel;
          dy = (f.data.dirY || 0) * travel;
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
              ? Math.floor(BattleFx.DEATH_FINAL_OP + (d.fromOp - BattleFx.DEATH_FINAL_OP) * (1 - t * t)) // easeIn 淡出至 140（R8：可辨残位而非隐身）
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
    // 到达命中边界时先放出数字，再驱动光效同帧切入命中段。
    BattleFx.tickPendingNumbers(advance);
    BattleFx.tickLights(advance);
    BattleFx.tickUltimateScene(advance);
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

  private static queueUltimateScene(layer: Node, spec: UltimateSceneSpec) {
    if (!ULTIMATE_THEMES[spec.heroId]) return;
    if (!BattleFx.ultimateScene) {
      BattleFx.ultimateScene = BattleFx.createUltimateScene(layer, spec);
      return;
    }
    // 保留最新施法者：最旧待播场景让位，队列有界且每位SSR仍有机会登场。
    if (BattleFx.ultimateSceneQueue.length >= MAX_ULT_SCENE_QUEUE) BattleFx.ultimateSceneQueue.shift();
    BattleFx.ultimateSceneQueue.push(spec);
  }

  private static cancelUltimateScene(uid: string) {
    BattleFx.ultimateSceneQueue = BattleFx.ultimateSceneQueue.filter(s => s.uid !== uid);
    const active = BattleFx.ultimateScene;
    if (active && active.spec.uid === uid && active.elapsed < 0.18) BattleFx.destroyUltimateScene();
  }

  private static createUltimateScene(layer: Node, spec: UltimateSceneSpec): UltimateSceneFx {
    const theme = ULTIMATE_THEMES[spec.heroId];
    const verticalScale = Math.max(1, view.getVisibleSize().height / 1280);
    const root = new Node('BfxUltimateScene_' + spec.heroId);
    root.addComponent(UITransform).setContentSize(720, 1280);
    // Keep the scene aligned with the battle field on tall phones, where page coordinates
    // are expanded vertically by CocosUi's FIXED_WIDTH layout.
    root.setScale(new Vec3(1, verticalScale, 1));
    const rootOpacity = root.addComponent(UIOpacity);
    const wash = new Node('SceneWash');
    wash.addComponent(UITransform).setContentSize(720, ULT_SCENE_FIELD_TOP - ULT_SCENE_FIELD_BOTTOM);
    wash.setPosition(0, (ULT_SCENE_FIELD_TOP + ULT_SCENE_FIELD_BOTTOM) / 2, 0);
    const wg = wash.addComponent(Graphics);
    wg.fillColor = new Color(theme.primary.r, theme.primary.g, theme.primary.b, 24);
    wg.rect(-350, -(ULT_SCENE_FIELD_TOP - ULT_SCENE_FIELD_BOTTOM) / 2, 700, ULT_SCENE_FIELD_TOP - ULT_SCENE_FIELD_BOTTOM);
    wg.fill();
    root.addChild(wash);

    const motif = new Node('SceneMotif_' + theme.motif);
    motif.addComponent(UITransform).setContentSize(680, 900);
    const mg = motif.addComponent(Graphics);
    BattleFx.drawUltimateMotif(mg, theme.motif, theme.primary, theme.accent);
    root.addChild(motif);

    layer.addChild(root);
    rootOpacity.opacity = 0;
    motif.setScale(new Vec3(0.72, 0.72, 1));
    return { root, motif, elapsed: 0, spec };
  }

  private static destroyUltimateScene() {
    const f = BattleFx.ultimateScene;
    if (!f) return;
    if (f.root.isValid) { f.root.removeFromParent(); f.root.destroy(); }
    BattleFx.ultimateScene = null;
  }

  private static tickUltimateScene(advance: number) {
    if (!BattleFx.ultimateScene && BattleFx.ultimateSceneQueue.length) {
      const next = BattleFx.ultimateSceneQueue.shift()!;
      const state = BattleFx.view;
      const layer = state ? CocosUi.ensureBattleSceneLayer(state.content, state.ui.node('BattleHeader')) : null;
      if (layer && layer.isValid) BattleFx.ultimateScene = BattleFx.createUltimateScene(layer, next);
    }
    const f = BattleFx.ultimateScene;
    if (!f) return;
    if (!f.root.isValid) {
      // Page redraws such as changing speed destroy the content child layer. Replay the
      // interrupted scene at the head of the bounded queue under the rebuilt battle HUD.
      BattleFx.ultimateScene = null;
      if (BattleFx.ultimateSceneQueue.length >= MAX_ULT_SCENE_QUEUE) BattleFx.ultimateSceneQueue.pop();
      BattleFx.ultimateSceneQueue.unshift(f.spec);
      return;
    }
    f.elapsed += advance;
    const t = Math.min(1, f.elapsed / ULT_SCENE_LIFE);
    const opacity = f.elapsed < 0.16 ? 205 * BattleFx.easeOutQuad(f.elapsed / 0.16)
      : f.elapsed < 0.57 ? 205 : 205 * (1 - BattleFx.easeInOutQuad((f.elapsed - 0.57) / (ULT_SCENE_LIFE - 0.57)));
    const rootOp = f.root.getComponent(UIOpacity);
    if (rootOp) rootOp.opacity = Math.max(0, Math.round(opacity));
    const impact = f.elapsed < 0.48 ? 0 : Math.min(1, (f.elapsed - 0.48) / 0.42);
    const scale = f.elapsed < 0.18 ? 0.72 + 0.32 * BattleFx.easeOutQuad(f.elapsed / 0.18)
      : 1.04 + 0.12 * BattleFx.easeOutQuad(impact);
    f.motif.setScale(new Vec3(scale, scale, 1));
    f.motif.angle = (f.spec.heroId === 'simayi' || f.spec.heroId === 'zhugeliang' ? 28 : -12) * t;
    if (f.elapsed >= ULT_SCENE_LIFE) BattleFx.destroyUltimateScene();
  }

  /** One pre-rendered native Graphics motif per SSR; animation only transforms/alpha-blends nodes. */
  private static drawUltimateMotif(g: Graphics, motif: UltimateMotif, primary: Color, accent: Color) {
    const ring = (r: number, color = primary, width = 3) => { g.strokeColor = color; g.lineWidth = width; g.circle(0, 0, r); g.stroke(); };
    const ray = (x1: number, y1: number, x2: number, y2: number, color = primary, width = 5) => {
      g.strokeColor = color; g.lineWidth = width; g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    };
    const star = (x: number, y: number, r: number) => { g.fillColor = accent; BattleFx.star(g, x, y, r); };
    ring(314, primary, 3); ring(286, accent, 1.5);
    switch (motif) {
      case 'blossom':
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const x = Math.cos(a) * 160, y = Math.sin(a) * 160;
          g.strokeColor = i % 2 ? accent : primary; g.lineWidth = 3; g.circle(x, y, 29); g.stroke(); star(Math.cos(a) * 220, Math.sin(a) * 220, 11); }
        ring(105, accent, 4); break;
      case 'dragon':
        g.strokeColor = primary; g.lineWidth = 13; g.moveTo(-285, -115); g.bezierCurveTo(-120, 305, 110, 305, 288, -116); g.stroke();
        g.strokeColor = accent; g.lineWidth = 4; g.moveTo(-250, -185); g.bezierCurveTo(-35, 170, 70, 230, 255, -185); g.stroke(); star(0, 220, 22); break;
      case 'shock':
        ring(90, accent, 7); ring(168, primary, 6); ring(250, accent, 4);
        ray(-190, 130, -40, -22, accent, 8); ray(-40, -22, 68, 60, primary, 6); ray(68, 60, 185, -142, accent, 8); break;
      case 'multi':
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4 - 0.5; ray(Math.cos(a) * 280, Math.sin(a) * 280, -Math.cos(a) * 150, -Math.sin(a) * 150, i % 2 ? accent : primary, 7); star(Math.cos(a) * 205, Math.sin(a) * 205, 13); } break;
      case 'bagua':
        g.strokeColor = primary; g.lineWidth = 4; g.moveTo(0, 238); g.lineTo(168, 168); g.lineTo(238, 0); g.lineTo(168, -168); g.lineTo(0, -238); g.lineTo(-168, -168); g.lineTo(-238, 0); g.lineTo(-168, 168); g.close(); g.stroke();
        ring(130, accent, 3); for (let i = 0; i < 8; i++) star(Math.cos(i * Math.PI / 4) * 206, Math.sin(i * Math.PI / 4) * 206, 10); break;
      case 'arrow':
        ray(-295, 0, 280, 0, accent, 8); ray(-195, -12, 195, -12, primary, 2); ring(150, primary, 4); ring(92, accent, 3);
        ray(280, 0, 228, 27, accent, 6); ray(280, 0, 228, -27, accent, 6); break;
      case 'command':
        ray(-218, -236, -218, 236, accent, 6); ray(-218, 236, 36, 169, primary, 5); ray(36, 169, -218, 105, primary, 5);
        ray(-218, 105, 36, 38, primary, 5); ray(36, 38, -218, -28, primary, 5); ring(218, accent, 2); star(150, -215, 20); break;
      case 'eclipse':
        ring(198, primary, 10); ring(166, accent, 2); g.fillColor = new Color(8, 14, 32, 90); g.circle(0, 0, 148); g.fill();
        for (let i = 0; i < 6; i++) star(Math.cos(i * Math.PI / 3) * 258, Math.sin(i * Math.PI / 3) * 258, 10); break;
      case 'crossed':
        ray(-210, -245, 208, 245, primary, 12); ray(-208, 245, 210, -245, accent, 12);
        ring(158, accent, 4); star(0, 0, 28); break;
      case 'charge':
        for (let i = 0; i < 3; i++) { ray(-280 + i * 24, -220, 210 + i * 24, 220, i === 1 ? accent : primary, i === 1 ? 10 : 4); }
        ring(260, accent, 2); star(230, 200, 20); break;
      case 'wave':
        for (let i = 0; i < 5; i++) { const y = -190 + i * 95; g.strokeColor = i % 2 ? accent : primary; g.lineWidth = 9 - i;
          g.moveTo(-330, y); g.bezierCurveTo(-185, y + 85, -50, y - 72, 80, y + 7); g.bezierCurveTo(190, y + 70, 260, y - 45, 330, y + 20); g.stroke(); }
        break;
      case 'spear':
        ray(-240, -220, 220, 220, accent, 10); ray(-270, -95, -72, 100, primary, 5); ray(72, -100, 270, 96, primary, 5);
        ring(178, accent, 3); star(218, 218, 20); break;
      case 'firegrid':
        g.strokeColor = primary; g.lineWidth = 3;
        for (let x = -240; x <= 240; x += 80) { g.moveTo(x, -220); g.lineTo(x, 220); }
        for (let y = -200; y <= 200; y += 80) { g.moveTo(-240, y); g.lineTo(240, y); }
        g.stroke();
        for (let i = 0; i < 13; i++) star(-220 + (i % 5) * 104, -180 + Math.floor(i / 5) * 112, 9 + i % 3 * 3); break;
      case 'halberd':
        ray(0, -275, 0, 270, accent, 9); ray(-18, 120, -202, 238, primary, 13); ray(-202, 238, -128, 72, primary, 10);
        ray(18, 120, 194, 222, primary, 11); ray(194, 222, 152, 60, primary, 9); ring(174, accent, 3); break;
      case 'dance':
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const x = Math.cos(a) * 164, y = Math.sin(a) * 164;
          g.strokeColor = i % 2 ? accent : primary; g.lineWidth = 4; g.ellipse(x - 32, y - 16, 32, 16); g.stroke(); star(Math.cos(a) * 254, Math.sin(a) * 254, 9); }
        ring(106, accent, 2); break;
      case 'vortex':
        for (let i = 0; i < 4; i++) ring(74 + i * 54, i % 2 ? accent : primary, 8 - i);
        ray(-255, -165, -85, -45, accent, 7); ray(255, 165, 85, 45, primary, 7); star(0, 0, 25); break;
    }
  }

  /** 只接受规则层在同步 castUlt 作用域标记的 cast 受体，最多三处代表目标。
   * 无 cast 的后续 HOT/环境事件保持即时；buff/dot 无受体时回退施法者脉冲。 */
  private static ultTargets(events: any[], start: number, uid: string): string[] {
    const targets: string[] = [];
    for (let i = start + 1; i < events.length; i++) {
      const ev = events[i];
      if (!ev) continue;
      const recipient = ev.cast === uid && (ev.e === 'hit'
        || ev.e === 'heal' || ev.e === 'shield' || ev.e === 'cc' || ev.e === 'ccImmune');
      if (recipient && ev.uid && !targets.includes(ev.uid)) targets.push(ev.uid);
      if (targets.length === 3) break;
    }
    return targets.length ? targets : [uid];
  }

  private static skillStyle(cls: string): SkillStyle {
    if (cls === 'tank' || cls === 'warrior') return 'melee';
    if (cls === 'archer') return 'ranged';
    if (cls === 'mage' || cls === 'support') return 'magic';
    return 'pulse';
  }

  private static lightColor(faction: string, style: SkillStyle): Color {
    if (style === 'pulse') return GOLD;
    if (faction === 'wei') return hexColor('#87c9f7');
    if (faction === 'shu') return hexColor('#8fe5b8');
    if (faction === 'wu') return hexColor('#ffbd78');
    if (faction === 'qun') return hexColor('#d4a1fa');
    return GOLD;
  }

  private static lightAnchor(ui: CocosUi, indexByUid: Map<string, number>, uid: string): Node | null {
    const idx = indexByUid.get(uid);
    if (idx === undefined) return null;
    const node = ui.node('FighterGlyph' + idx) || ui.node('Fighter' + idx);
    return node && node.isValid && isFinite(node.position.x) && isFinite(node.position.y) ? node : null;
  }

  private static makeLightPart(root: Node, name: string, draw: (g: Graphics) => void): LightPart {
    const node = new Node(name);
    node.addComponent(UITransform).setContentSize(120, 120);
    const g = node.addComponent(Graphics);
    draw(g);
    const op = node.addComponent(UIOpacity);
    root.addChild(node);
    node.active = false;
    return { node, op };
  }

  /** 精细星芒/符文均并入同一个 Graphics，不为每颗粒子增加节点。 */
  private static star(g: Graphics, x: number, y: number, r: number) {
    g.moveTo(x, y + r); g.lineTo(x + r * 0.28, y + r * 0.28);
    g.lineTo(x + r, y); g.lineTo(x + r * 0.28, y - r * 0.28);
    g.lineTo(x, y - r); g.lineTo(x - r * 0.28, y - r * 0.28);
    g.lineTo(x - r, y); g.lineTo(x - r * 0.28, y + r * 0.28);
    g.close(); g.fill();
  }

  private static drawCharge(g: Graphics, style: SkillStyle, color: Color) {
    g.strokeColor = color; g.lineWidth = 2;
    g.circle(0, 0, 38); g.stroke();
    g.strokeColor = GOLD_HI; g.lineWidth = 1;
    if (style === 'magic') {
      g.circle(0, 0, 29); g.stroke();
      // 断环与六瓣符文，相比实心光晕可保留立绘可读性。
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        g.arc(0, 0, 44, a, a + 0.32, false); g.stroke();
        const x = Math.cos(a) * 35, y = Math.sin(a) * 35;
        g.moveTo(x - 3, y); g.lineTo(x, y + 4); g.lineTo(x + 3, y); g.lineTo(x, y - 4); g.close(); g.stroke();
      }
    } else {
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + 0.3;
        g.arc(0, 0, 43, a, a + 0.6, false); g.stroke();
      }
    }
    g.fillColor = GOLD_HI;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      BattleFx.star(g, Math.cos(a) * 39, Math.sin(a) * 39, 3);
    }
  }

  private static drawRelease(g: Graphics, style: SkillStyle, color: Color, ultimate: boolean) {
    const size = ultimate ? 1 : 0.6;
    g.strokeColor = color; g.fillColor = color;
    if (style === 'melee') {
      // 双层月牙：沿弹道 x 轴前行，头部明亮、尾部细薄。
      g.lineWidth = 8 * size;
      g.moveTo(-24 * size, -25 * size);
      g.bezierCurveTo(38 * size, -17 * size, 38 * size, 17 * size, -24 * size, 25 * size); g.stroke();
      g.strokeColor = GOLD_HI; g.lineWidth = 2 * size;
      g.moveTo(-20 * size, -23 * size);
      g.bezierCurveTo(30 * size, -15 * size, 30 * size, 15 * size, -20 * size, 23 * size); g.stroke();
    } else if (style === 'ranged') {
      g.lineWidth = 3 * size;
      g.moveTo(-42 * size, 0); g.lineTo(17 * size, 0); g.stroke();
      g.moveTo(24 * size, 0); g.lineTo(9 * size, 7 * size); g.lineTo(12 * size, 0);
      g.lineTo(9 * size, -7 * size); g.close(); g.fill();
      g.strokeColor = GOLD_HI; g.lineWidth = size;
      g.moveTo(-30 * size, 0); g.lineTo(14 * size, 0); g.stroke();
      if (ultimate) {
        g.strokeColor = color; g.lineWidth = 1;
        g.moveTo(-28, 8); g.lineTo(3, 8); g.moveTo(-28, -8); g.lineTo(3, -8); g.stroke();
      }
    } else {
      g.lineWidth = 2;
      g.circle(0, 0, (style === 'magic' ? 12 : 19) * size); g.stroke();
      g.strokeColor = GOLD_HI; g.circle(0, 0, 6 * size); g.stroke();
      g.fillColor = GOLD_HI; BattleFx.star(g, 0, 0, 9 * size);
      g.fillColor = color;
      for (let i = 0; i < 3; i++) g.circle((-18 - i * 9) * size, (i % 2 ? 4 : -3) * size, (3 - i * 0.6) * size);
      g.fill();
    }
  }

  private static drawImpact(g: Graphics, style: SkillStyle, color: Color, ultimate: boolean) {
    const r = ultimate ? 27 : 13;
    g.strokeColor = color; g.lineWidth = ultimate ? 3 : 1.6;
    g.circle(0, 0, r); g.stroke();
    g.strokeColor = GOLD_HI; g.lineWidth = 1;
    if (style === 'melee') {
      g.moveTo(-r, -r * 0.6); g.lineTo(r, r * 0.6);
      g.moveTo(-r * 0.6, r); g.lineTo(r * 0.6, -r); g.stroke();
    } else if (style === 'magic' && ultimate) {
      g.circle(0, 0, r * 0.65); g.stroke();
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        g.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
        g.lineTo(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86);
      }
      g.stroke();
    } else {
      g.moveTo(-r * 0.7, 0); g.lineTo(r * 0.7, 0);
      g.moveTo(0, -r * 0.7); g.lineTo(0, r * 0.7); g.stroke();
    }
    g.fillColor = GOLD_HI; BattleFx.star(g, 0, 0, ultimate ? 8 : 4);
  }

  private static spawnLight(layer: Node, ui: CocosUi, indexByUid: Map<string, number>, snapshot: any[],
    uid: string, targetUids: string[], ultimate: boolean): SkillLight | null {
    const source = BattleFx.lightAnchor(ui, indexByUid, uid);
    if (!source) return null;
    // 不叠加同一施法者的同类序列；大招接管自己的短普攻，避免轮廓噪声。
    if (BattleFx.lights.some(f => f.uid === uid && (f.ultimate || !ultimate))) return null;
    if (ultimate) {
      for (let i = BattleFx.lights.length - 1; i >= 0; i--) {
        if (BattleFx.lights[i].uid !== uid) continue;
        BattleFx.destroyLight(BattleFx.lights[i]); BattleFx.lights.splice(i, 1);
      }
    }
    if (BattleFx.lights.filter(f => f.ultimate === ultimate).length >= (ultimate ? MAX_SKILL_FX : MAX_ATTACK_FX)) return null;
    const targetNodes = targetUids.slice(0, ultimate ? 3 : 1)
      .map(t => BattleFx.lightAnchor(ui, indexByUid, t)).filter((n): n is Node => !!n);
    if (!targetNodes.length) return null;
    const unit = snapshot[indexByUid.get(uid)!];
    const style = BattleFx.skillStyle(unit && unit.cls);
    const color = BattleFx.lightColor(unit && unit.faction, style);
    const root = new Node(ultimate ? 'BfxSkill_' + style : 'BfxAttack_' + style);
    root.addComponent(UITransform).setContentSize(720, 1280);
    layer.addChild(root);
    const charge = ultimate ? BattleFx.makeLightPart(root, 'BfxCharge', g => BattleFx.drawCharge(g, style, color)) : null;
    const targets = targetNodes.map(anchor => ({
      anchor,
      release: BattleFx.makeLightPart(root, 'BfxRelease', g => BattleFx.drawRelease(g, style, color, ultimate)),
      impact: BattleFx.makeLightPart(root, 'BfxImpact', g => BattleFx.drawImpact(g, style, color, ultimate)),
      spark: ultimate ? BattleFx.makeLightPart(root, 'BfxSparks', g => {
        g.fillColor = color;
        BattleFx.star(g, -22, 5, 4); BattleFx.star(g, 19, 12, 3);
        g.fillColor = GOLD_HI;
        BattleFx.star(g, -8, 23, 3); BattleFx.star(g, 12, -5, 2);
      }) : null,
    }));
    const light: SkillLight = { root, uid, source, style, ultimate, elapsed: 0, charge, targets };
    BattleFx.lights.push(light);
    BattleFx.updateLight(light); // 创建当帧即显示蓄力/弹道，不额外等待下一帧。
    return light;
  }

  private static queueNumber(light: SkillLight, layer: Node, ui: CocosUi, ev: any, indexByUid: Map<string, number>) {
    if (!light.root.isValid || BattleFx.pendingNumbers.length >= MAX_DMG_NUM) return;
    const recipient = BattleFx.lightAnchor(ui, indexByUid, ev.uid);
    if (!recipient) return;
    BattleFx.pendingNumbers.push({ light, elapsed: 0,
      delay: Math.max(0, SKILL_CHARGE + SKILL_RELEASE - light.elapsed),
      ev: { e: ev.e, uid: ev.uid, src: ev.src, amount: ev.amount, crit: ev.crit, kind: ev.kind },
      recipient, layer, ui, indexByUid });
  }

  private static cancelPendingNumbers(uid: string) {
    BattleFx.pendingNumbers = BattleFx.pendingNumbers.filter(n => n.ev.uid !== uid && n.light.uid !== uid);
  }

  private static tickPendingNumbers(advance: number) {
    for (let i = BattleFx.pendingNumbers.length - 1; i >= 0; i--) {
      const n = BattleFx.pendingNumbers[i];
      n.elapsed += advance;
      if (!n.light.root.isValid || !n.light.source.isValid || !n.recipient.isValid || !n.layer.isValid) {
        BattleFx.pendingNumbers.splice(i, 1); continue;
      }
      if (n.elapsed + 1e-8 < n.delay) continue;
      BattleFx.spawnDmgNum(n.layer, n.ui, n.ev, n.indexByUid);
      if (n.ev.e === 'hit') BattleFx.spawnShake(n.ui, n.ev, n.indexByUid);
      BattleFx.pendingNumbers.splice(i, 1);
    }
  }

  private static destroyLight(light: SkillLight) {
    if (light.root.isValid) { light.root.removeFromParent(); light.root.destroy(); }
  }

  /** 死亡终止尚未释放的蓄力；已释放的命中保留，不改死亡/复活主信道。 */
  private static cancelCharge(uid: string) {
    for (let i = BattleFx.lights.length - 1; i >= 0; i--) {
      const f = BattleFx.lights[i];
      if (f.uid === uid && f.ultimate && f.elapsed < SKILL_CHARGE) {
        BattleFx.destroyLight(f); BattleFx.lights.splice(i, 1);
      }
    }
  }

  private static tickLights(advance: number) {
    for (let i = BattleFx.lights.length - 1; i >= 0; i--) {
      const f = BattleFx.lights[i];
      f.elapsed += advance;
      const duration = f.ultimate ? SKILL_CHARGE + SKILL_RELEASE + SKILL_IMPACT : ATTACK_RELEASE + ATTACK_IMPACT;
      // 页面重建/越界失效立即清场。死亡卡仍有效，因此真实致死命中能正常显示。
      const anchors = [f.source, ...f.targets.map(t => t.anchor)];
      if (!f.root.isValid || anchors.some(n => !n.isValid || !isFinite(n.position.x) || !isFinite(n.position.y))
        || f.elapsed >= duration) {
        BattleFx.destroyLight(f); BattleFx.lights.splice(i, 1); continue;
      }
      BattleFx.updateLight(f);
    }
  }

  /** 三段共享一个模拟时钟，倍速/中途切速同步；只改原生节点，不逐帧绘制或建粒子。 */
  private static updateLight(f: SkillLight) {
    const chargeTime = f.ultimate ? SKILL_CHARGE : 0;
    const releaseTime = f.ultimate ? SKILL_RELEASE : ATTACK_RELEASE;
    const impactTime = f.ultimate ? SKILL_IMPACT : ATTACK_IMPACT;
    const elapsed = f.elapsed;
    const from = f.source.position;
    if (f.charge) {
      const q = Math.min(1, elapsed / chargeTime);
      f.charge.node.active = elapsed + 1e-8 < chargeTime;
      f.charge.node.setPosition(from.x, from.y, 0);
      f.charge.node.setScale(0.72 + 0.28 * q, 0.72 + 0.28 * q, 1);
      f.charge.node.angle = (f.style === 'magic' ? 90 : 35) * q;
      f.charge.op.opacity = Math.round(110 + 120 * q);
    }
    // 同数字队列使用极小浮点容差，.20/.48 秒边界不会相差一帧。
    const release = (elapsed - chargeTime + 1e-8) / releaseTime;
    const impact = (elapsed - chargeTime - releaseTime + 1e-8) / impactTime;
    for (const target of f.targets) {
      const to = target.anchor.position;
      const q = Math.max(0, Math.min(1, release));
      const travel = f.style === 'melee' ? BattleFx.easeOutQuad(q) : q;
      const dx = to.x - from.x, dy = to.y - from.y;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      target.release.node.active = release >= 0 && release < 1;
      target.release.node.setPosition(from.x + dx * travel, from.y + dy * travel, 0);
      target.release.node.angle = f.style === 'pulse' ? q * 120 : angle;
      const rs = f.ultimate ? 0.7 + 0.3 * Math.sin(q * Math.PI) : 1;
      target.release.node.setScale(rs, rs, 1);
      target.release.op.opacity = Math.round(220 - 40 * q);
      target.impact.node.active = impact >= 0 && impact < 1;
      const p = Math.max(0, Math.min(1, impact));
      const size = 0.45 + BattleFx.easeOutQuad(p) * (f.ultimate ? 0.9 : 0.65);
      target.impact.node.setPosition(to.x, to.y, 0);
      target.impact.node.setScale(size, size, 1);
      target.impact.node.angle = f.style === 'magic' ? p * 35 : angle;
      target.impact.op.opacity = Math.round(245 * (1 - p));
      if (target.spark) {
        target.spark.node.active = impact >= 0 && impact < 1;
        target.spark.node.setPosition(to.x, to.y + p * 18, 0);
        target.spark.node.setScale(0.6 + p * 0.7, 0.6 + p * 0.7, 1);
        target.spark.op.opacity = Math.round(220 * (1 - p));
      }
    }
  }

  /** 单位寻址 + 守卫：援军 slot=5 越界时节点 x=undefined（backX[2]），isFinite 不合法则本帧动效跳过。 */
  private static anchorOf(indexByUid: Map<string, number>, ui: CocosUi, uid: string): { x: number; y: number } | null {
    const idx = indexByUid.get(uid);
    if (idx === undefined) return null;
    // 锚点取全身立绘 FighterGlyph{i}，让弹道、伤害数字围绕玩家实际看到的角色。
    const node = ui.node('FighterGlyph' + idx) || ui.node('Fighter' + idx);
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
   *   静默重挂透明终态；已有终态（opacity 已为终态值）则零写入。
   */
  private static scanAlive(snapshot: any[], ui: CocosUi, indexByUid: Map<string, number>) {
    for (const u of snapshot) {
      if (!u || !u.uid || !BattleFx.deadFaded.has(u.uid)) continue;
      if (u.alive !== false) {
        BattleFx.killFadeFx(u.uid);
        BattleFx.setFadeOpacity(ui, indexByUid, u.uid, 255);
        BattleFx.deadFaded.delete(u.uid);
      } else if (!BattleFx.hasFadeFx(u.uid)) {
        BattleFx.setFadeOpacity(ui, indexByUid, u.uid, BattleFx.DEATH_FINAL_OP, true);
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
    const heal = ev.e === 'heal';
    const crit = !heal && !!ev.crit;
    const fontSize = crit ? 32 : 24;
    const node = new Node(heal ? 'BfxHeal' : 'BfxDmg');
    // Glyph 锚点位于全身立绘中心；数字从头顶上方冒出，避免盖住血条。
    const baseX = anchor.x + Math.floor(Math.random() * 80 - 40);
    const baseY = anchor.y + 98;
    node.setPosition(new Vec3(baseX, baseY, 0));
    node.addComponent(UITransform).setContentSize(120, Math.max(fontSize * 2.4, 46));
    const label = node.addComponent(Label);
    label.string = (heal ? '+' : '') + String(ev.amount);
    label.fontFamily = 'sans-serif';
    label.fontSize = fontSize;
    label.lineHeight = fontSize * 1.3;
    label.color = heal ? hexColor('#8fe5b8') : crit ? new Color(255, 120, 40, 255) : new Color(255, 255, 200, 255);
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
   * 大招横幅：中轴对阵区 440×38 金框，1.2s 淡出；只保留最新一条，避免压住单位状态。
   * A4 入场增强：亮金描边叠加层（子节点，同几何加粗一档）随滑入自 255 衰减至 0——
   * "描边加亮后回落金框"；Graphics 各画一次，动画全走 UIOpacity/位置，零逐帧重绘。
   */
  private static spawnUltBanner(layer: Node, ui: CocosUi, ev: any, indexByUid: Map<string, number>) {
    const anchor = BattleFx.anchorOf(indexByUid, ui, ev.uid);
    if (!anchor) return;
    for (let i = BattleFx.items.length - 1; i >= 0; i--) {
      const f = BattleFx.items[i];
      if (f.kind !== 'ultBanner') continue;
      if (f.node && f.node.isValid) { f.node.removeFromParent(); f.node.destroy(); }
      BattleFx.items.splice(i, 1);
    }
    const node = new Node('BfxUlt');
    const center = ui.node('BattleVsBg') || ui.node('BattleVs');
    const baseX = 0;
    const baseY = center && center.isValid ? center.position.y : 8;
    node.setPosition(new Vec3(baseX, baseY + BANNER_SLIDE_DIST, 0)); // 滑入起点：终位上方 14px
    node.addComponent(UITransform).setContentSize(440, 38);
    const g = node.addComponent(Graphics);
    g.fillColor = new Color(46, 26, 12, 230);
    g.roundRect(-220, -19, 440, 38, 6);
    g.fill();
    g.strokeColor = GOLD;
    g.lineWidth = 2;
    g.roundRect(-219, -18, 438, 36, 6);
    g.stroke();
    const glow = new Node('BfxUltGlow');
    glow.addComponent(UITransform).setContentSize(440, 38);
    const gg = glow.addComponent(Graphics);
    gg.strokeColor = GOLD_HI;
    gg.lineWidth = 3.5;
    gg.roundRect(-219, -18, 438, 36, 6);
    gg.stroke();
    node.addChild(glow);
    const textNode = new Node('BfxUltText');
    textNode.addComponent(UITransform).setContentSize(420, 36);
    const label = textNode.addComponent(Label);
    label.string = (ev.caster ? ev.caster + ' · ' : '') + String(ev.skill || '');
    label.fontFamily = 'serif';
    label.enableWrapText = false;
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
   * 攻击位移：近战向 act.tgt 的立绘锚点前压，弓手/法师留位配合真实弹道。
   */
  private static spawnLunge(ui: CocosUi, ev: any, indexByUid: Map<string, number>, snapshot: any[]) {
    if (BattleFx.countKind('lunge') >= MAX_DRIVEN) return;
    if (BattleFx.hasDrivenFx(ev.uid)) return; // 同 uid 活跃即跳过（防抖振/坐标争写）
    if (BattleFx.hasFadeFx(ev.uid)) return;   // A3：淡出/复活活跃期间让位（死亡单位不再 act，理论兜底）
    const driven = BattleFx.drivenOf(indexByUid, ui, ev.uid);
    if (!driven) return;
    const target=ev.tgt?BattleFx.anchorOf(indexByUid,ui,ev.tgt):null;
    const source=BattleFx.anchorOf(indexByUid,ui,ev.uid);
    const unit=snapshot[indexByUid.get(ev.uid)!];
    const remote=!!(unit&&(unit.cls==='archer'||unit.cls==='mage'||unit.cls==='support'));
    let dirX=unit&&unit.side==='B'?-1:1,dirY=0;
    if(target&&source){
      const dx=target.x-source.x,dy=target.y-source.y,len=Math.max(1,Math.sqrt(dx*dx+dy*dy));
      dirX=dx/len;dirY=dy/len;
    }
    BattleFx.items.push({
      kind: 'lunge', node: null, driven, opacity: null, glowOp: null, elapsed: 0, duration: LUNGE_DUR,
      data: { baseX: driven[0].baseX, baseY: driven[0].baseY, dirX, dirY, dist:remote?10:LUNGE_DIST, uid: ev.uid },
    });
  }

  /**
   * 大招前冲（A2）：ult 事件驱施放者 Fighter+Glyph 朝敌阵横向冲锋（0.5s，比普通 lunge
   * 更大更慢，配合金框横幅构成释放仪式感）。与 lunge/shake 共用驱动型互斥槽：施放瞬间同 uid
   * 有活跃动效则让位（横幅仍在，主反馈不丢）；castUlt 与行动回合错帧，实际几乎必播。
   */
  private static spawnUltLunge(ui: CocosUi, ev: any, indexByUid: Map<string, number>) {
    if (BattleFx.countKind('ultLunge') >= MAX_DRIVEN) return;
    if (BattleFx.hasDrivenFx(ev.uid)) return;
    if (BattleFx.hasFadeFx(ev.uid)) return; // A3：淡出/复活活跃期间让位
    const driven = BattleFx.drivenOf(indexByUid, ui, ev.uid);
    if (!driven) return;
    const dirX = driven[0].baseX < 0 ? 1 : -1; // 左右阵型：朝敌方阵营方向冲
    BattleFx.items.push({
      kind: 'ultLunge', node: null, driven, opacity: null, glowOp: null, elapsed: 0, duration: ULT_LUNGE_DUR,
      data: { baseX: driven[0].baseX, baseY: driven[0].baseY, dirX, dirY:0, uid: ev.uid },
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
