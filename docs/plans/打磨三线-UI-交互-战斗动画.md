# 打磨三线：UI 优化 · 交互优化 · 战斗简单动画

状态：**草案待实施**（三角色研讨会已完成并交叉评审，结论收敛为本批次队列；实施从下一轮心跳开始，不需要用户逐批确认）。
成文：2026-10-03（Asia/Shanghai）；主持人：zcode（会话内三角色研讨：体验官 / 竞品角色 / 动画角色）。
依据：`assets/scripts/CocosBootstrap.ts`、`assets/scripts/ui/CocosUi.ts`、`assets/scripts/screens/BattleScreens.ts`、`assets/scripts/screens/CampaignScreens.ts`、`assets/scripts/ui/Scenery.ts`、`utils/battle.js`（events/popups/snapshot 结构）；实拍 `/tmp/tk-close/`（bg3 六页，2026-10-03，美术阶段五页背景+描金框体接入后）；性能基线 `session_context.md`（战斗 60.1 FPS 稳锁 vsync、三场连续 heap 49.5→41.5MB 无泄漏）。

## 轮换规则（执行者必读）

- 心跳每轮（20 分钟）取**一个**待办批实施，三线轮转，全局顺序已按"性价比 × 依赖"排定：
  **U1 → I1 → A0 → U2 → I2 → A1 → U3 → I3 → A2 → U4 → I4 → A3 → U5 → I5 → A4 → U6 → I6 → A5**
- 每批 = 一次可交付：走完整验证链（见下）→ commit + push → 本文档状态列改「完成（待验收）」→ `session_context.md` 记交接。用户介入时先回应用户，再继续队列。
- 单批实施受阻（依赖缺失/验收不过）时记「受阻」并写明原因，跳到下一线下一批，不空转。

## 红线（全批适用）

1. **导航条上沿 -548 以下不可占用**；新增元素先核对纵向空间预算，同页新增区块 >3 个先做整页排版。
2. **战斗动画线（A）纯表现层**：零 `utils/` 改动，只消费引擎**既有**的 `step().events` / `snapshot()` / `popups` / `lastUlt`，不改数值、不改战斗结果、不改存档结构。
3. 交互线涉及 `store` 的新增 mutation（仅 I4 批量熔炼）必须：复用既有单件逻辑聚合、比率与数值锚不动、smoke 增断言、旧档兼容（缺字段默认值）。
4. 动画与飞包一律走**每帧 update(dt) 驱动**（帧率无关），对齐 `CocosUi.floaters` 既有模式；模块态 fx 列表必须在新战斗/页面切换时重置（`_popupCount` 跨场残留 P2 教训）。
5. 每批涉及页面必须无头浏览器实拍回归；截图发现重叠/截断/遮挡当批修掉。动画批另加**帧率复测**：3 场连续战斗 ≥55 FPS（基线 60.1），heap 无增长趋势（基线 49.5→41.5MB）。
6. 通用验证链：`node scripts/cocos-sync-domain.js --check`（触 utils 时）→ `tsc --noEmit --pretty false` → 实拍 → 触 store 的批次跑 smoke → 需要包体时 `./scripts/cocos-build.sh wechatgame`。

## 现状盘点（研讨会输入摘要）

- **表现层钩子已齐**：`utils/battle.js` 的 `step()` 返回 `{events, done, winner, time}`，events 含 `act{uid,type,tgt}`（攻击者→目标）、`hit{uid,src,amount,crit,kind}`、`death{uid}`、`ult{uid,skill}`、`shieldHit`、`heal`、`cc` 等；**Bootstrap.update 目前只消费 popups/lastUlt，events 整体被丢弃**——动画线全部素材零引擎改动即可获得。
- **已有可复用**：`CocosUi.floatText`（fxLayer 跨页存活 + updateFloaters dt 驱动）、`vibrateShort`、tap 按压 0.97 缩放、`navBadges` 红点、`U.dot`、`firstTimeOverlay`（13 处）、navigation 返回栈、战斗伤害飘字与大招横幅（1.2s 淡出）、败北处方单、阵型模板、扫荡、一键收获。
- **实拍缺陷（bg3 六页 + roundB2/B3）**：①全站 `'›'` 箭头在楷体下渲染成逗号状（主城建筑副标题、调整编队 › 等十余处）；②英雄页碎片兑换副标题截断（"SSR0 SR0 R0 N0 各/10›"不可读）；③英雄卡 SSR 品质角标被右上"战"徽章遮盖；④战役页底部四层密带（挂机行/出征行/GoalStrip/右侧"双倍/快收"仅 147×24 热区）；⑤二级页返回样式三种混用（左上小字 y=484/609、底部大按钮）；⑥弹层关闭行为四种范式不一致。
- **战斗表现现状**：单位为静态姓氏卡，0.3s 跳变刷新血/怒条；阵亡仅名字加"· 阵亡"后缀，无淡出/倒下；无受击反馈、无攻击位移；结算大字静态直出。

---

## 一、UI 优化线（对齐描金/纸黄/Q 版国风，治理杂乱与状态反馈）

| 批次 | 内容 | 验收标准 | 状态 |
| --- | --- | --- | --- |
| U1 全站文案截断与角标遮挡修复 | ① `'›'` 楷体渲染成逗号状：grep 全站 `'›'` 逐处清点（主城 BuildingHint、调整编队›、CampEdit、CityGoal 等），统一替换为可读箭头（`'›'`→`'>'` 或 text() 助手内集中替换）；② 英雄页碎片兑换副标题加宽/精简，消除"SSR0 SR0 R0 N0 各/10›"截断；③ 英雄卡 SSR 品质角标与右上"战"徽章重叠：角标下移或徽章缩径。 | 主城/英雄/编队/召回合集实拍：无逗号状箭头、无截断、无遮挡；tsc 通过。 | 待办 |
| U2 战役页底部密带重排 | 底部现四层压为三层：挂机信息行（y-393）/ 出征行（y-480）/ GoalStrip（y-536，恰好贴 -548 红线）保留；右侧"双倍 / 快收"147×24 小热区并入挂机信息行（改为行内按钮 ≥150×44）或降级为挂机面板内入口+红点；GoalStrip 行高与热区 ≥40。 | 实拍无重叠挤压；-548 红线不破；所有可点热区高度 ≥40；双倍/快收入口仍可达（两次点击内）。 | 完成（待验收） |
| U3 快捷角标与资源 pill 组件化 | ① 主城角标（每日任务/背包）label 与面板边缘间距修复（label 底边距 ≥6px）；② journey/shop 五资源 pill 字号 16→18，抽 `CocosUi.resourcePills()` 助手，与主城资源行同源消除两处不一致。 | 主城/玩法/集市三页实拍样式一致、无裁切；tsc。 | 待办 |
| U4 弹层规范统一 | 四种弹层范式收口为两类：**说明/详情类**（firstTimeOverlay、battleDetail、agenda）=点遮罩可关+统一标题 30 号金描边；**决策类**（Confirm、IdleChoice、stagePreview）=仅按钮关闭防误触；统一九宫格框体 ui_frame、圆角、标题排印；文档内登记每弹层归属。 | 逐弹层实拍：关闭行为与登记表一致、框体样式一致；遮罩误关为零。 | 待办 |
| U5 红点口径补全 | journey 六入口（群英塔/演武/军屯/周Boss/四时/悬赏）+ 英雄页（名将试炼可挑战）按 store 既有 canClaim/attemptsLeft 布尔补 `U.dot`；口径统一="红点亮起=有收益可领或免费次数可用"（对齐今日军务文案承诺）；nav 徽章逻辑不重复叠加。 | 实拍红点与 `__tkDiag` 布尔逐项一致；无可领时零误亮；机检脚本可选。 | 完成（待验收；journey 五入口落地，英雄页无试炼入口故不含） |
| U6 列表空态与去向引导 | 补空态：英雄列表筛选无结果（"该阵营暂无武将 · 去招募›"）、背包军械图鉴/熔炉空态已有文案补去向按钮、成就/图鉴未解锁行给获取途径一行提示。 | 空态实拍均有文案+去向，不出现白板区域；不新增纵向高度溢出。 | 完成（待验收；英雄/熔炉空态此前已达标，本批补成就进度列与熔炉空态去向） |

## 二、交互优化线（对标剑与远征等卡牌放置成熟惯例）

已实现不再重做：按压缩放、nav 红点、中央领取飞字、胜利震动、返回栈、跳过/加速/自动、败北处方、阵型模板、扫荡。

| 批次 | 内容 | 验收标准 | 状态 |
| --- | --- | --- | --- |
| I1 返回通道组件化 | 新增 `CocosUi.backBar(ctx, fallback)`：左上"‹ 返回"统一字号 24、热区 ≥140×52、统一 y 基线；替换 ~17 处手写返回（grep「返回」清点），保留各页 fallback 语义；底部大按钮统一 296×56 样式。此批为 I2 的组件前置（实施为 backBar(action, label?, y=484)，编队页保留专用槽位 y=609；剩余：quests/shop 底部大按钮尺寸统一，移入 I2 顺手）。 | 全站二级页实拍：左上返回位置/字号/热区一致；返回跳转语义不回归；tsc。 | 完成（待验收） |
| I2 面包屑路径条 | 二级页 backBar 下方显示"主城 › 玩法 › 军屯"路径（navigation 栈已有数据，无需新状态），点任一环直达；层级 ≤2 不显示避免拥挤。 | 三级路径（战役→玩法→军屯）实拍：显示正确、逐环跳转正确、不与标题/返回重叠。 | 完成（待验收；实测样例为 战役>编队>选择武将） |
| I3 领取飞包动画 | `tell()` 成功带 reward 时，在现有中央飘字外新增"资源图标从触发按钮飞向顶部对应资源 pill"（起点=按钮坐标、终点=pill 坐标、0.5s 直线缓动、fx 列表 update 驱动），落地 pill scale 1→1.15→1 脉冲；关键领取按钮点击加 `vibrateShort`。 | 实拍录屏 ≥3 帧确认轨迹与落地脉冲；资源数字刷新时机不被动画阻塞；跨页返回时 fx 自动清理。 | 待办 |
| I4 熔炉一键熔炼 + 确认排查 | store 新增 `smeltMeltBatch(filter)`：循环既有单件 `smeltMelt` 聚合（**比率不变**=数值锚不动），UI 加"一键熔炼 N 件"按钮走 `confirm()` 二次确认；全站排查无确认的破坏性操作（熔炼/清空类）统一收口 `confirm()`。 | smoke 增批量断言（批量结果=逐件之和）；旧档兼容；实拍确认弹层与汇总 notice；200 种子锚不跑（零数值变更，smoke+镜像即可）。 | 完成（待验收；全站破坏性操作确认排查并入 I6 新手走查顺带） |
| I5 抽卡结果逐张揭示 | summonResults 卡片初始隐藏，按序 80ms 逐张弹入（scale 1.15→1 + 淡入），SSR/NEW 最后压轴+金框闪一次；点任意处跳过全部入场即时全亮；纯表现，lastSummon 数据与掉落逻辑零改动。 | 实拍序列帧：单抽/十连/SSR 压轴三态；跳过手势可用；十连 4×3 网格不重叠；揭示总时长 ≤1.2s 不拖节奏。 | 待办 |
| I6 新手引导触点审计收口 | TUTORIALS 13 键落覆盖表（页面×时机）；补首日链缺口：首关出战→首胜领取→自动出征→招募首抽顺序核对；审计"同页只弹一个浮层"约定违例（借将弹层置顶修复已有先例）；TUTORIAL_OFF 开关保留可一键关。 | 新档无头走查 10 分钟：首日新概念弹层同屏 ≤3 个；无叠弹/抢弹；覆盖表写入本文档附录或评审文档。 | 待办 |

## 三、战斗简单动画线（纯表现层；每批验收含帧率复测）

先行批（轮转外）：结算页胜负大字入场动画（缩放回弹+淡入，Tween 一次性，无 fx 列表）——**完成（待验收）** c116fc7。

实现总原则：fx 对象数组 + `BattleFx.tick(dt)` 由 `Bootstrap.update` 战斗分支调用（对齐 floaters 的帧率无关模式）；不用跨页 Tween（show() 会销毁节点，fx.tick 内判 `node.isValid` 自动清理）；动画结束一律 setPosition/setScale 归位；新战斗与离开 battle 页必清空 fx 列表。**零 `utils/` 改动，全部消费既有 events/snapshot。**

| 批次 | 内容 | 验收标准 | 状态 |
| --- | --- | --- | --- |
| A0 表现层基建：events 消费管线 | 新增 `assets/scripts/ui/BattleFx.ts`（或 BattleScreens 模块态）：fx 数组 {node, elapsed, life, apply(t)} + `tick(dt)`；`Bootstrap.update` 把当前被丢弃的 `step()` 返回 `events` 传入 `BattleFx.feed(events, snapshot)`；重置钩子全覆盖：`startBattle`/`startWeekBoss`/`startReplay`/`finishBattle`/`go()` 离开 battle。 | tsc；连续两场战斗节点数不残留（机检或日志证明）；**帧率复测 ≥55 FPS**（基线 60.1）且 heap 无增长（基线 49.5→41.5MB）。 | 完成（待验收 7265704；实测 60.0 FPS，含伤害数字每帧化死路修复与 startReplay 重置补齐） |
| A1 受击闪白+抖动（hit 事件） | `hit{uid,src}` → 定位受击者 Fighter 坐标，叠加白色圆角覆盖节点（90×91 圆角 13，alpha 0.85→0，0.12s）+ 水平抖动 dx=sin(t·π)·5·方向（方向=远离攻击方），结束归零；同帧同 uid 多 hit 去重只保留一条。 | 实拍战斗序列帧可见闪白/抖动；无节点残留；**帧率复测 ≥55 FPS**；群攻同帧 ≤10 覆盖节点无掉帧。 | 待办 |
| A2 攻击位移 lunge（act 事件） | `act{uid,tgt}` → 攻击者 Fighter 节点朝目标水平前冲 14px：0→60ms easeOut 冲出、60→180ms easeOutBack 回弹（过冲 2px），由 fx.tick 设置位置、不改常驻坐标；同一 uid fx 活跃时限频跳过（加速 ×4 事件密集防抖成筛子）。 | 实拍可见冲位移回弹；加速 ×4 下无高频抖振；动画后位置精确归位（对照截图逐像素）；**帧率复测 ≥55 FPS**。 | 待办 |
| A3 阵亡淡出倒下（death 事件 + 复活校验） | `death{uid}` → Fighter 面板 angle 0→85°（0.25s easeIn）+ UIOpacity →90（35%）+ 名字/字形转 muted，血怒条保留可读；**复活校验与动画同批实现**：refreshBattleView 每次比对 snapshot.alive，复活（张角/孟获 cheatRevive 30%）反向复位 0.2s，防"幽灵位"。 | 实拍阵亡倒下与复活回位各一例；阵亡后血条仍可读；**帧率复测 ≥55 FPS**；跨场不残留倒下态。 | 待办 |
| A4 怒气满脉冲 + 大招横幅入场 | energy≥100 单位 EnergyBar scale 1+0.06·sin(t·6) 呼吸脉冲；卡框金↔亮金交替用**两枚预制 rim 节点切 visible**（不逐帧重绘 Graphics 防 overdraw）；`ult` 事件→现有 UltPopup 加滑入（y +14→0，90ms easeOut）与描边加亮。 | 实拍怒气满呼吸光与横幅滑入；Graphics 逐帧重绘为零（代码审查）；**帧率复测 ≥55 FPS**。 | 待办 |
| A5 胜负大字入场 + 暴击弹跳 | resultView 渲染后 ResultTitle 一次性 fx：scale 2.4→1（0.35s easeOutBack）+ 淡入（前 40%），胜利加描边闪一次（LabelOutline width 1→3→1）；暴击伤害数字首帧 scale 1.6→1（0.18s，combatPopupDisplay 对象加 scale 字段），普通字不变。 | 结算实拍大字入场（回放态同样生效）；暴击/普通数字样式分级可见；result 页反复进出无 fx 残留；**帧率复测 ≥55 FPS**。 | 待办 |

---

## 四、交叉评审记录（三角色各 3 点）

**体验官**
1. `'›'` 箭头楷体渲染成逗号状（全站十余处）——**采纳**为 U1 核心：bug 级观感损伤，描金新风格下最扎眼，修复成本极低。
2. 战役页底部四层密带 + "双倍/快收"147×24 热区远低于触控下限——**采纳**为 U2；-548 红线已贴边，只许做减法。
3. 全站字号普查——**否决**：无系统性截图证据支撑、范围过大；仅在 U3 资源 pill 一处落地统一（16→18）。

**竞品角色**
1. 领取动效应"飞向资源栏"+落点脉冲（放置游戏核心反馈环）——**采纳** I3；floatText/fxLayer 底子已有，增量小。
2. 批量操作：一键熔炼——**采纳** I4（聚合不改比率，smoke 兜底）；"悬赏一键派遣"——**否决**：悬赏本就低频、单次选择有取舍参与感，批量反而稀释玩法。
3. 左滑返回手势——**否决**：微信小游戏无小程序页面栈手势，平台不支持；面包屑（I2）+ 统一返回件（I1）为替代方案，采纳拆分实施。

**动画角色**
1. 引擎 `step().events` 已含 act/hit/death/ult 全套事件但被 Bootstrap 丢弃——**采纳**为 A0 前提：动画线全部素材零引擎改动，天然满足"禁止改战斗结果"红线。
2. 优先级受击闪白 > lunge > 阵亡淡出 > 怒气脉冲 > 胜负大字——**采纳**并微调：胜负大字成本最低，与暴击弹跳合并为 A5 收尾批；阵亡批必须带复活回位校验同批落地（张角/孟获 cheatRevive 30%，拆批会留"幽灵位"P1）。
3. 战场灰烬/胜利纸屑粒子——**否决**：包体与帧率风险高、性价比低；胜利表达已有 vibrateShort+传檄分享，够用。

## 五、变更记录

- 2026-10-03：建立。三角色研讨 + 交叉评审收敛，18 批（UI 6 / 交互 6 / 动画 6），全部待办。轮换顺序与红线见文档头。实施者每完成一批：状态列改「完成（待验收）」并在本节追加一行变更记录。
- 2026-10-02：规格代理追加「六、A 线实施规格」（A0–A5 可直接实施级）。headless 直调引擎实测 events 全结构；BattleFx 落点收敛为 `services/BattleFx.ts`；登记 7 项现状调研事实，其中 2 处待修缺陷（DmgNum/UltPopup 战斗进行中不可见、startReplay 缺跨场重置）纳入 A0 范围。

---

## 六、A 线实施规格（A0–A5，2026-10-02 规格调研产出）

依据：headless 直调 `utils/battle.js`（seed=20261003，蜀 Lv20 张飞/关羽/刘备/赵云/黄月英 vs 魏 Lv21 许褚/夏侯惇/贾诩/荀彧/郭嘉，dt=0.1 逐步至终局 61.2s，赵云 `startHpPct:0.18` 诱发免死）+ 通读 `CocosBootstrap.ts` / `screens/BattleScreens.ts` / `ui/CocosUi.ts` / `screens/ScreenContext.ts`。零 utils 改动红线经核实成立：所需数据全部在 `step().events` / `snapshot()` / `popups` / 事件流里。

### 6.1 events 实测结构（样本 + 字段表）

全场事件种类 census（数量 | 事件(字段)）：

```
  195 act(uid,type,tgt)          324 hit(uid,src,amount,crit,kind)
   23 ult(uid,skill,scope)        25 heal(uid,amount)
    3 shield(uid,amount)          11 shieldHit(uid,amount)
   12 cc(uid,kind,dur)            11 ccEnd(uid)
    7 death(uid)                   1 cheat(uid,pct)
    1 end(winner,duration)
```

前 30 秒代表性样本（每类真实输出，JSON 原样）：

```
t=0.3s  {"e":"act","uid":"B0","type":"atk","tgt":"A0"}
t=0.3s  {"e":"hit","uid":"A0","src":"B0","amount":155,"crit":false,"kind":"atk"}
t=0.3s  {"e":"hit","uid":"B0","src":null,"amount":15,"crit":false,"kind":"reflect"}
t=0.5s  {"e":"hit","uid":"A1","src":"B4","amount":765,"crit":true,"kind":"atk"}
t=8.1s  {"e":"ult","uid":"B0","skill":"裸衣奋战","scope":"row"}
t=8.1s  {"e":"shield","uid":"B0","amount":612}
t=8.6s  {"e":"shieldHit","uid":"B0","amount":118}
t=11.2s {"e":"ult","uid":"A0","skill":"当阳断喝","scope":"row"}
t=11.2s {"e":"cc","uid":"B0","kind":"stun","dur":3}
t=11.2s {"e":"hit","uid":"B0","src":"A0","amount":230,"crit":false,"kind":"ult"}
t=14.1s {"e":"ccEnd","uid":"B0"}
t=17.5s {"e":"ult","uid":"A1","skill":"青龙偃月斩","scope":"row"}
t=18.5s {"e":"hit","uid":"B0","src":null,"amount":294,"crit":false,"kind":"dot:bleed"}
t=20.5s {"e":"heal","uid":"A0","amount":763}
```

字段核实备注（样本未触发、代码核实的三种）：`ccImmune{uid}`（battle.js:284，仅碰到 ccImmune 被动的词缀 Boss）；`reinforce{uid,name}`（援军词缀，headless 复现：`{"e":"reinforce","uid":"B5","name":"典韦"}`）；`end` 超时变体多一个 `timeout:true`。`hit.kind` 实测取值：`'atk' | 'ult' | 'reflect' | 'env' | 'dot:<burn/bleed/poison>'`。

配套数据结构实测：

- `popups`：`{uid, amount, crit, time}` **累计数组**（本场 220 条，全场增长），Bootstrap 用 `_popupCount` 做增量切片。只含 applyDamage 直伤——**dot/reflect/env 走 dealRaw，有 hit 事件但无 popup**。
- `lastUlt`：单对象 `{uid, name, time}`，每次大招覆盖（非列表）；Bootstrap 观测到变化时补 `wallTime=Date.now()`。
- `snapshot()`：`{uid, side, slot, name, hp, maxHp, shield, energy, alive, cc, dots}`，顺序恒为 A 侧在前 B 侧在后，**数组下标 = 战斗页节点序号 i**（drawFighter/refreshBattleView 同一序号）。

### 6.2 调研发现的与批次表假设不符的事实（7 条，实施前必读）

1. **战场是上下排布，不是左右**：`fighterPosition` A 侧 y=-208/-405（画面下方）、B 侧 y=245/480（上方）。A1 表内"水平抖动 dx"、A2 表内"水平前冲 14px"方向轴写反了，本规格改为**纵向**：攻击者 A→B 向上冲（+y）、B→A 向下冲（−y）；受击抖动同理远离攻击方。
2. **战斗进行中伤害数字与 ult 横幅实际不可见（现存缺陷）**：`DmgNum*`/`UltPopup` 画在 `drawField`（仅 `show()` 整页重绘执行），而 `update()` 每帧只调 `refreshBattleView`（仅刷血/怒条/名字/计时，BattleScreens.ts:145-154）。平静的手动/自动战斗全程无整页重绘 → popups/lastUlt 的现渲染路径是死路。**A0 将两块渲染迁入 BattleFx 每帧管线（视觉参数照抄现状）**，这也是 A0 的可见验收物。
3. **startReplay 缺跨场重置（现存缺陷）**：`CocosBootstrap.ts:366-377` 无 `_popupCount=0`/`combatPopupDisplay=[]`/`lastUltDisplay=''`（对照 startBattle:497-499、startWeekBoss:443-445 均有）→ 回放战斗的伤害数字会被上一场的 `_popupCount` 抑制。红线 4 的 P2 教训未覆盖回放路径，A0 补齐。
4. **`hit.src` 可为 null**（reflect/dot/env 不带攻击者）：方向性动效必须空值兜底——只闪白不抖。
5. **复活有专属事件 `cheat{uid,pct}`**：A3 表内"refreshBattleView 比对 snapshot.alive"保留为兜底，主触发改用 cheat 事件（同帧精确、无轮询延迟）。
6. **`ult` 事件实测多带 `scope` 字段**（`'all'|'row'|'single'`，castUlt 派生好）：横幅定位/文案宽度直接可用，无需重推目标范围。
7. **两个相邻现存缺陷，A0 只做守卫不修布局**：①援军 `slot=5` 越界——`fighterPosition('B',5)` 取 `backX[2]=undefined`（headless 复现援军 snapshot slot=5），战斗页把援军画在 x=undefined；BattleFx 建 uid→节点映射时 `isFinite` 守卫，非法坐标 uid 本帧全部动效跳过，布局修复另立批次。②`drawFighter` 的一个单位=**6 个兄弟节点**（Fighter/Glyph/CC/HPBg+HP/EnergyBg+Energy/Name 全部直挂 content，无单位容器）：A2/A3 必须同时驱动 `Fighter{i}` 与 `FighterGlyph{i}`（同圆心同角度），血/怒条与名字保持不动。

### 6.3 BattleFx 模块设计

- **文件**：`assets/scripts/services/BattleFx.ts`（三线表 A0 行的"ui/BattleFx.ts（或 BattleScreens 模块态）"按本节收敛为 services/：它是有状态每帧服务，同类先例 AutoBattleSession；且不 import 任何 screens，避免分层倒挂。`.meta` 由 Creator 导入自动生成）。
- **依赖**：仅 `'cc'`（Node/Graphics/Label/UIOpacity/LabelOutline/Color/Vec3）+ `CocosUi.ensureFxLayer`。不 import screens/utils。
- **API（全静态，模块态单例）**：
  - `reset()`——清空 fx 数组、能量脉冲表、per-uid 冷却表，销毁本模块创建的 overlay 节点。语义即表内 "onBattleStart(clear)"，进场/离场钩子统一调它。
  - `feed(events: any[], snapshot: any[], ui: CocosUi)`——每帧把 `step().events` 与一次 `snapshot()` 传入；内部建 `uid→{index, side, slot}` 映射与节点查找，按 6.4 规则生成 fx。
  - `tick(dt: number, speed: number)`——`elapsed += dt * speed`（×4 时动画同步加快，对齐现状 popupLife/refreshGap 除速惯例）；`node.isValid` 不真则直接弃（show() 重绘销毁后的自清理）；到期先**归位**（position/angle/scale/opacity 写回 `data.base*`）再 destroy/splice。
  - `onBattleEnd()`——finishBattle 调用，内部即 `reset()`（保留显式命名便于回读）。
  - `syncAlive(snapshot, ui)`——A3 兜底，refreshBattleView 每 0.3s 调一次，比对上次 alive 补漏。
  - `live`（getter）——现存 fx 数，挂进 `__tkDiag` 返回值供机检（跨场残留断言用）。
- **fx 对象结构**（与 `CocosUi.floaters` 同构：数组 + 每帧 tick + isValid 弃 + 到期 destroy；差异仅多 driven 与归位快照）：
  ```ts
  interface BattleFxItem {
    kind: 'dmgNum'|'ultBanner'|'hitFlash'|'shake'|'lunge'|'deathFall'|'revive'|'energyPulse';
    node?: Node;        // 本模块创建的 overlay（dmgNum/ultBanner/hitFlash/rim）
    driven: Node[];     // 被驱动的既有节点（shake/lunge: Fighter+Glyph；deathFall: 同 + UIOpacity）
    elapsed: number; duration: number;   // 秒，按 speed 加速累计
    data: { base?: {x:number;y:number;angle:number;scale:number}; dir?: number;
            uid?: string; text?: string; crit?: boolean };
  }
  ```
- **层与单位寻址**：overlay 挂 `CocosUi.ensureFxLayer(content)`（fxLayer 与 content 同父、渲染在其上，跨页存活——所以 reset 钩子必须全，红线 4）；坐标**不重算、不 import fighterPosition**，overlay 直接 copy 目标节点 `position`（同父同坐标系，天然绕开 verticalScale）；单位节点按 snapshot 下标 i 取名 `Fighter{i}`/`FighterGlyph{i}`/`FighterName{i}`，为此 `CocosUi` 增加公有 getter `node(name: string): Node | undefined { return this.nodes.get(name); }`（2 行，`nodes` 保持私有）。
- **预算与去重**：同帧 one-shot fx 上限 32，超限丢弃当帧新增的 hitFlash/shake/lunge（deathFall/revive/ultBanner 豁免——低频且必演）；dmgNum 同屏上限 24；hitFlash per-uid 冷却 0.15s（战斗时，兼顾 env 每秒全场 tick 与 ×4 密度）；lunge 同 uid 活跃即跳过（A2 表内防抖）。

### 6.4 A0–A5 逐批实施清单

**A0 基建 + 伤害数字/横幅每帧化**（零视觉新增，含一处现状缺陷修复）
- 改动文件：
  - 新增 `assets/scripts/services/BattleFx.ts`：reset/feed/tick/onBattleEnd/live + `dmgNum`、`ultBanner` 两类 fx。
  - `assets/scripts/ui/CocosUi.ts`：加 `node(name)` getter。
  - `assets/scripts/CocosBootstrap.ts`：①update() 战斗分支每帧 `const snap = this.fighting.snapshot(); BattleFx.feed(step.events, snap, this.ui); BattleFx.tick(dt, speed)`，并用 snap 替换弹字循环里逐 popup 的 `snapshot()` 调用；②`combatPopupDisplay` 推入/过滤逻辑与 `_popupCount`、`lastUltDisplay`/`wallTime` 观测块删除（职责整体迁入 BattleFx，其内部自维护 popups 增量计数）；③`startBattle`/`startWeekBoss`/`startReplay` 建战斗后加 `BattleFx.reset()`，startReplay 同时补 `_popupCount=0; this.combatPopupDisplay=[]; this.lastUltDisplay=''`（6.2-3）；④`finishBattle` 两分支与 `go()` 离开 battle 的中断分支加 `BattleFx.onBattleEnd()`；⑤`__tkDiag` 返回值加 `fx: BattleFx.live`。
  - `assets/scripts/screens/BattleScreens.ts`：drawField 删除 `DmgNum*` 与 `UltPopup` 两个渲染块（result 页本就渲染不出可见内容——战斗结束后 bornAt 过期 alpha=0）。
- 触发数据：`fighting.popups` 增量（dmgNum）、`ult` 事件（ultBanner）。
- 参数照抄现状：dmgNum=受击者头顶（Fighter 节点 pos + (0,-30)）±40 随机抖动、暴击 32 号橙/普通 24 号淡黄、寿命 800/speed ms、上飘 60px 线性淡出；ultBanner=施放者头顶（pos +(0,-80)）、260×42 金框、1.2s 淡出（前 900ms 全亮 230）。
- 验收画面：战斗中伤害数字**逐帧出现**（现状不可见即本批回归证据）；`__tkDiag().fx` 连打两场后为 0；帧率 ≥55、heap 无增长。

**A1 受击闪白+纵向抖动**
- 改动：仅 `BattleFx.ts`（+hitFlash/shake 两类）。触发 `hit{uid,src,kind}`：同帧同 uid 去重、per-uid 冷却 0.15s、`kind==='env'` 只闪白不抖。
- 参数：overlay=90×91 圆角 13 白（238,230,210）Graphics+UIOpacity 217→0（0.12s，覆盖在 Fighter 节点坐标）；shake=driven Fighter+Glyph，dy=5·sin(π·t/0.12)·dir（A 侧受击 dir=-1 向下、B 侧 +1 向上，按受击者 side 定；`src=null` 不抖），0.12s 归位。
- 验收画面：序列帧可见闪白与纵向抖动；群攻同帧 ≤10 overlay 无掉帧；无残留。

**A2 攻击位移 lunge（纵向）**
- 改动：仅 `BattleFx.ts`（+lunge）。触发 `act{uid,tgt}`（与对应 hit 同帧到达：攻击者前冲与目标闪白同帧起播，节奏正确）。
- 参数：driven Fighter+Glyph 沿攻击方向位移 14px（A 侧攻击 +y、B 侧 −y）：0→60ms easeOut 冲出、60→180ms 回弹过冲 2px；同 uid 活跃 lunge 跳过；结束 position 写回 data.base（逐像素归位）。
- 验收画面：可见冲位回弹；×4 无抖振；动画结束帧与静止帧截图逐像素一致。

**A3 阵亡倒下 + 复活回位**
- 改动：`BattleFx.ts`（+deathFall/revive）+ `BattleScreens.refreshBattleView` 末尾 1 行 `BattleFx.syncAlive(snapshot, ui)`。
- 触发与参数：`death{uid}` → 0.25s easeIn：Fighter+Glyph `angle 0→85`（A 侧 +85 倒向画面下缘、B 侧 −85）、UIOpacity 255→90、`FighterName{i}` Label color→muted(170,176,151)（'· 阵亡' 后缀仍由 refreshBattleView 写）；`cheat{uid}`（实测存在，6.2-5）→ 0.2s 反向复位（angle→0、opacity→255、名字色还原），feed 时先移除该 uid 活跃 deathFall；syncAlive 兜底：alive=false 且无活跃/已定格 deathFall → 直接置终态（无动画），false→true → 补播 revive。
- 验收画面：倒下与复活各一例实拍（赵云 cheatDeath 或周 Boss 张角/孟获 cheatRevivePct 0.3）；阵亡后血/怒条可读；跨场新战斗全员直立。

**A4 怒气满脉冲 + 横幅入场**
- 改动：仅 `BattleFx.ts`（+energyPulse 常驻态、ultBanner 滑入增强）。触发：feed 的 snapshot `energy>=100 && alive` 进 pulse 态、<100 或 !alive 退出（Map<uid>，reset 清）；`ult` 事件 → banner 加滑入。
- 参数：`Fighter{i}` 卡 scale=1+0.06·sin(t·6)（**不得用 Energy{i} 条**——updateProgress 每 0.3s setScale 会覆盖脉冲）；两枚预制 rim overlay（金/亮金 Graphics roundRect 描边，置于卡坐标）切 visible 3Hz 交替，不逐帧重绘 Graphics；ultBanner 滑入 y+14→0（90ms easeOut）+ 描边加亮。
- 验收画面：怒满单位呼吸可见；代码审查确认零逐帧 Graphics 重绘；帧率 ≥55。

**A5 暴击弹跳 + 胜利描边闪**
- 改动：`BattleFx.ts`（dmgNum crit 首帧 scale 1.6→1，0.18s）+ `BattleScreens.resultView`（ResultTitle 追加 LabelOutline width 1→3→1 一次性 Tween，胜利才闪；沿用先行批 c116fc7 模式）。表内"combatPopupDisplay 加 scale 字段"随 A0 迁移自然失效，弹跳在 BattleFx dmgNum 内实现。
- 验收画面：结算大字描边闪一次（回放态同样生效）；暴击/普通数字分级可见；result 反复进出无残留。

### 6.5 风险与回归清单

1. **跨场残留**：重置钩子 5 处全覆盖（startBattle/startWeekBoss/startReplay/finishBattle/go 离开 battle）+ 机检断言 `__tkDiag().fx===0`（连打两场）；fxLayer 跨页存活是既有前提而非新增风险，靠 reset 兜住。
2. **暂停/跳过/倍速**：autoSession suspended 时 update 不进战斗分支 → feed/tick 同停（动画冻结与战斗冻结一致，正确）；skipBattle 的 1000×step 事件不入 feed，finishBattle 直接 reset（无爆发）；×4 下 tick 用 dt×speed，动画等效缩短，对齐 popupLife 现状惯例；事件密度由 32/24 预算兜底。
3. **结算页复用 battleView**（drawField 用 lastBattleSnapshot 重画全员）：finishBattle 先 onBattleEnd → 结算页无 overlay；驱动型 fx 引用的 Fighter 节点被 show('result') 重建 → tick isValid 自清理。战斗中整页重绘（加速按钮/notice 过期/onShow 前后台）同理自愈。
4. **先行批既有暴露**（登记不修）：resultView 每次 show 重播大字入场（notice 过期重绘触发）；A5 顺手可加"同一 outcome 只播一次"守卫。
5. **帧率回归**：每批 3 连场 ≥55 FPS（基线 60.1）+ heap 无增长（基线 49.5→41.5MB）；A0 特别对照点：每帧多一次 snapshot() 分配（10 个小对象），超标则回退为复用弹字循环快照。
6. **援军 NaN 守卫**：isFinite 检查在 feed 建映射时做，非法 uid 本帧动效全跳过；`fighterPosition` slot≥5 布局修复另立批次（本规格不夹带）。
7. **回放一致性**：startReplay 重置补齐后，回放与实况走同一 fx 管线，动画表现天然一致。
