# tk_afk 共享上下文（挂机定三国 · 微信/抖音双平台小游戏）

> 本文件是跨会话、跨执行者（zcode / codex / 其他 harness）的共享上下文，按 `AGENTS.md`「共享上下文交接」纪律维护：**开工先读本文件；收工在「最近交接」最上方追加本轮条目**。只新增不删改，纠错追加新记录。"已实施"不等于"已验收"，同一任务双方结论分开展示。

## 当前有效基线（2026-09-26 核对）

- 项目：三国放置卡牌小游戏（Canvas 渲染），玩法对标 AFK Arena；**微信 + 抖音双平台**（2026-09-26 起）。微信 AppID `wx03eb4074ce45033b`；抖音 AppID `ttdd05abb8437df5b602`（2026-09-26 已填入）。
- 仓库：远程 `github.com/gukp1993/tk_afk`（SSH 推送，分支 main）；本地 `/Users/gukepeng/Desktop/ai/miniProgram/tk_afk`。
- 技术形态：原生 JS，无 npm 依赖。共享源码 `src/`（表现层）+ `utils/`（内核，`platform.js` 为唯一 wx/tt 适配层）；`build.js` 把共享源码同步进打包目录 `wechat/`（微信开发者工具打开）与 `douyin/`（抖音开发者工具打开），打包目录内 src/utils 是 gitignore 的生成物。
- 验证命令：`node build.js`（打包同步，发布前必跑）、`node test/smoke.js`（127 项，含广告桥接契约）、`node test/static-check.js`（285 项，含双平台入口/打包目录一致性/平台 API 收口）；离屏渲染审查 `node preview/mini/record.js` + `python3 preview/mini/makeview.py`。
- 广告分两层：`src/ads.js` 业务门面（零平台分支）+ `src/ads/bridge.js` 桥接层（统一 `show() → Promise<{ended}>` 契约，微信/抖音接入差异收口）；当前测试模式（内置模拟广告），正式变现按平台填 `AD.rewardedUnitIds`（{wechat, douyin}）即切真广告。
- 存档 key `sanguo_afk_save_v1`（平台存储，两平台相互独立）；改存档结构必须向后兼容旧档。
- 根目录不再是开发者工具项目目录（入口文件已迁入 `wechat/`）；`legacy-miniprogram/` 旧版微信小程序存档参考，不参与打包。
- `.gitignore`：`.DS_Store`、`project.private.config.json`、`node_modules/`、`*.log`、`*.tmp`、`/wechat/src|utils/`、`/douyin/src|utils/`。
- 2026-09-26 初始提交 `a5516f7`、双平台改造提交已推送远程；协作设施 `AGENTS.md` 与本文件已建立。

## 最近交接（新 → 旧）

### 战役地图系统方案提案（对标剑与远征） · zcode · 无变更（提案待拍板）

时间：2026-09-26；执行者：zcode

纯设计任务，未改任何代码。应用户「要类似剑与远征的地图系统，地图上有关卡」需求交付方案。现状：战役无地图，主城一键「出征」直进 cleared+1 开打；数据层已齐备（stages.chapterOf / story.CHAPTERS 12 章×10 关 / 存档 campaign.cleared），做地图**存档零改动、utils 零改动**。推荐形态 A「每章一屏卷轴地图」（10 节点 S 形路径+顶部章节切换，对齐演义 12 章叙事）而非 B「120 关一张连续大卷轴」。P1：新增 src/screens/campaign.js（程序化宣纸底/远山，节点三态已通✓/当前鎏金脉动/锁定🔒，名将关大节点带敌将 heroFace，点当前关弹战前敌阵面板再开战）+ home 出征改入口 + battle 结算加「返回地图」次按钮，scenes.js/record.js 同步，不动底部导航 TABS。P2：每章主题装饰、评星（存档 v3→v4）、章节 intro 弹层；P3：连续大卷轴/地图成就。
- 拍板项：①形态 A/B（推荐 A）；②点节点直接开战还是先弹战前面板（推荐先弹面板）；③已通关节点回打入口保留（沿用现有重复挑战入账行为）。
- 风险预判：ui.js 存量「滚动后命中错位 / 1px 移动吞点击」缺陷（今日评审条目在案）会在地图滚动+节点点击场景放大，若验收受影响随本项一并修（ui.js 属热点文件需收口）。
- 下一步：用户拍板后转实施；拍板前不动代码。

### 多维游戏体验评审与整改方案 · Codex · 需求已交付

时间：2026-09-26；执行者：Codex（负责人收口，两个只读子 agent 分别审计战斗与剧情/养成）；状态：需求已交付。

- 概要：按用户“从UI、交互、剧情、战斗、特效等角度锐评并给详细方案”交付 `docs/game-experience-review-2026-09-26.md`。评审运行代码基线为 bd5ad5d，期间另一会话768aed6仅追加交接，无运行代码差异。未修改游戏代码、数值、存档或打包产物；方案不等于新增产品决定，保留SSR2%固定无保底口径。
- 发现：独立内存复现战斗帧率影响逻辑速度、正常/跳过步长改变部分样本胜负、生命被动未生效、塔战败推层且显示奖励不入账、SR兵魂材料未扣、挂机招募令小数丢失、SSR遣散档位错误与装备删除；代码链确认自选卡权益未持久化、广告复活重置敌人且削弱己方。UI复现滚动后命中错位、1px移动吞点击；实际Canvas画面确认群英排序超屏、卡片文字压头像、短屏十连确认被底栏覆盖。完整证据/限制/验收见文档。历史战役结算缺陷已修，本次指出的是塔分支残留。
- 验证：原源码临时浏览器Canvas容器检查主城/群英/详情/剧情/短屏十连，所有平台存储为临时内存桩；纯Node定向复现不访问真机存档；smoke 388/388、static-check 291/291通过。没有双平台真机性能/留存验证，既有测试通过不代表这些新发现场景被覆盖。
- 下一步：建议先修资产/战斗一致性/输入可信性，再完成首屏与第一章样板、基础动作/声音、核心8–12将视觉，最后扩内容。此次仅评审交付，整改尚未实施。

### 英雄数据存放位置问答（纯问答） · zcode · 无变更

时间：2026-09-26；执行者：zcode

纯问答：定位英雄信息的三层存放——定义层 `utils/heroes.js`（HEROES 数组，当前 120 将四档：N37/R43/SR24/SSR16，含属性/大招/被动）、数值层 `utils/config.js`（RARITIES/ASCEND_COST/GACHA 等）、玩家状态层 `utils/store.js` 的 state.roster（经 platform.js 持久化，key `sanguo_afk_save_v1`，存档 v3 带迁移链）。会话内交付，未改代码。核对时确认：store.js 已含共鸣水晶（crystalInfo/effectiveLevel）与英雄重置（resetHero），抽卡为四档固定概率无保底——今日并行会话已实施抽卡改版与剧情关卡，与交接记录相符。

### 剧情关卡 P1 实施（演义剧情战役） · zcode · 已实施，待验收

时间：2026-09-26；执行者：zcode

按用户「执行开发任务」指令实施剧情关卡提案 P1（提案 5 项拍板未逐项答复，按方案推荐默认执行：文案量级 A 档/章末宝箱元宝×100+招募令×1/评星扫荡留二期/麦城夷陵按「虽败犹荣」改编/配角武将留二期）。①新增 `utils/story.js`：12 章演义时间轴（黄巾之乱→虎牢关→群雄逐鹿→官渡之战→三顾茅庐→长坂坡→赤壁之战→汉中之战→荆州易帜→火烧连营→南征南中→星落五丈原）× 10 关共 120 关纯数据剧情表——每关事件名/战前旁白、名将关（第 10 关）对白、显式 5 人敌阵，敌将 id 全部锁定现有 120 将池（黄巾/南蛮配角缺失处以低稀群雄客串、文案不点破）；②`stages.js`：makeStageEnemies 优先读剧情表，超 120 关走循环乱世兜底，兜底章节表自 story 派生（单一数据源）；③`battle.js`：战前剧情弹层（打字机+点击推进+跳过剧情，看过记档不再弹，弹层期间战斗暂停，含名将关胜利章节结语）；④`store.js`：存档 v2→v3（campaign.storySeen，v1/v2 旧档链式迁移向后兼容）+ 章末宝箱。
- **顺带修复三项存量缺陷**（前两项为既有登记，第三项本轮新发现）：①battle.js finish() 无条件调 winCampaign——战败也发首通+推关，已改仅凯旋结算；②stages.js 陈旧 id xiahouddun 由并行会话先行修复（7225f06），本轮以「剧情表显式敌阵+兜底表派生」根治该类问题；③winCampaign 的 gold/exp/gem/scroll 此前只展示不实际入账（仅装备真实入账），已改 applyReward 入账（含宝箱）。
- 验证：node build.js 同步各 27 文件；node test/smoke.js **388/388**（+27：剧情表完整性/优先读表/超表兜底/宝箱入账/迁移链）；node test/static-check.js **291/291**；离屏 19 屏重出（新增 story-dialog），story-dialog/battle-live/battle-result/home 经视觉 agent **两轮验收通过**——第一轮 battle-live fail 系 record.js 截帧时序（140 帧时战斗必已结束，改 30 帧修复），battle-result fail 经复审确认系验收方跨文件误引坐标已正式撤销（飘字 0.9s 淡出行为正常）。AGENTS.md/README 计数与战役行已同步；.gitignore 增 png_story/。
- 决定：无新的产品口径变化，均按提案推荐默认；「剧情表内 120 关后重复挑战给小额奖励且真实入账」为顺带行为变化（此前展示未入账），数值手感由用户验收。
- 风险/待办：①第 1/11 章黄巾/南蛮敌阵复用群雄武将客串（张宝/管亥/兀突骨等不在池内），二期新增配角武将时替换；②复盘验收 agent 观察的「战斗开场同点多条飘字叠加」VFX 间距可打磨项（未处理）；③record 管线的 SvgCtx 忽略 ctx.scale（右半空条）与 qlmanage 底部裁切为已登记存量伪影，未修；④提交 64a9250 已推送远程。
- 下一步：用户验收——开发者工具导入 wechat/（或 douyin/）打第 1 章看剧情弹层与章末宝箱；文案量级/宝箱数值如需调整集中在 utils/story.js 与 store.js 的 CHAPTER_CHEST；二期（评星/扫荡/演义录回看/配角武将）待拍板。

### 测试资源设置问答（10W 元宝/招募令） · zcode · 无变更

时间：2026-09-26；执行者：zcode

纯问答：用户要给自己设 10W 元宝+10W 招募令测抽卡。未改代码（避免测试数值进包），交付开发者工具 Console 粘贴脚本——直接改存储 `sanguo_afk_save_v1` 的 `res.gem/res.scroll` 后立刻「编译」重启（游戏有 10 秒心跳自动存档，拖久会被内存态覆盖回）；抖音端同脚本换 `tt`；两平台存档独立。清缓存即重置。

### 抽卡改版：120 将四档武将池 + 固定概率招募 · zcode · 已实施，待验收

时间：2026-09-26；执行者：zcode（含 2 个并行子 agent：legacy 审计 / 全池战斗模拟）

按用户指令实施抽卡改版：①抽卡去保底改四档固定概率（SSR 2%/SR 10%/R 28%/N 60%，`config.GACHA` 只留 rates，`state.summon` 只留 total，旧档向后兼容）；②`utils/heroes.js` 全量重建 120 将（白N37/蓝R43/紫SR24/橙SSR16，蜀32魏35吴27群26，28 个旧 id 基本保留），每将必杀技+被动按三国演义典故设计，全部落在既有引擎效果集内；③稀有度四档化适配：RARITIES/RARITY 改 N/R/SR/SSR（maxStar 2/3/4/5）、点将台概率图例面板、卡面金框阈值 `rarity===4`、编队/图鉴 maxStar、商店自选池档位与商品名着色；④smoke 保底断言改概率分布断言。并行子 agent 结论：legacy 审计无崩溃级引用（legacy 自身 utils 不存在本就不能独立运行，若同跑会有错档显示，按「legacy 不做 UI 迭代维护」原则记录不修）；120 将全池模拟 474 场无 NaN、效果语义 29 项全过。修复过程中发现并处理：ui.wrap 未显式设置 textAlign 被右对齐污染（整行画出画布外）；svgctx 测宽偏窄造成预览断行假阳性（CJK 1.0em→1.08em）；夏侯惇 id 重建时 xiahouddun→xiahoudun 导致 stages.js 敌人引用悬空（已同步）。

- **决定**：抽卡无保底为用户明确口径；战斗引擎三缺陷顺手修复（`ENERGY_ATK` 普攻回能接线——怒气原只能靠受击攒、法师/辅助 2/3 放不出大，接线后随机阵容大招覆盖 61/120→**120/120**；`strongestEnemy` 改取 maxHp 最高者对齐技能文案；沉默从硬控改仅禁大招、hot/dot 不再被控制状态跳过，原 hasSilence 为死代码）。
- **验证**：`node build.js` 各 26 文件；`node test/smoke.js` 361/361；`node test/static-check.js` 287/287；全池模拟复跑 1418 断言过（3 个旧断言翻转属预期）；离屏 18 屏重出，heroes/formation/shop/summon/summon-result 经视觉 agent 验收通过；6 个 commit（8dd32ce feat / a726f99 fix / a1ef951 chore / 9beb444+2a660a5 docs / 91e71d4 chore）已推送远程。
- **遗留（待产品决定）**：①战斗超时固定判 B 方负（引擎既定）；②`src/screens/battle.js` finish() 无条件调 winCampaign、战败也发首通（剧情关卡会话已登记归其 P1）；③模拟脚本 `/tmp/battle_sim_120.js` 可复跑；④抽卡动效三段式与立绘方案（本会话早前提案）仍未排期。
- 下一步：用户验收——微信开发者工具导入 wechat/（抖音 douyin/）实测点将台招募、四档配色与战斗节奏；如觉 SSR 2% 出货体感过冷，只调 `config.GACHA.rates` 即可。

### 剧情关卡需求方案提案（对标三国演义） · zcode · 无变更（提案待拍板）

时间：2026-09-26；执行者：zcode

纯设计任务，未改任何代码。应用户要求以《三国演义》为参考设计剧情关卡，会话内交付完整需求方案。核心：把现有 12 章×10 关程序生成战役改造为「演义剧情战役」——新增 `utils/story.js` 纯数据剧情表（每章 intro/finale + 每关事件名/旁白/对白/显式 5 人敌阵/名将关 boss），`stages.makeStageEnemies` 优先读表、缺表兜底现有程序生成；`src/ui.js` 扩展对白框组件（打字机+跳过，已看记存档）；数值曲线/首通奖励/战斗引擎零改动；存档 v2→v3 增 `storySeen`/`chestClaimed`（向后兼容）。方案含 12 章演义时间轴骨架（黄巾→虎牢→群雄→官渡→三顾→长坂→赤壁→汉中→荆州→夷陵→南征→五丈原）、章末宝箱（元宝×100+招募令×1）、P1-P3 分期与 5 项拍板（文案量级 A/B/C、宝箱数值、评星扫荡归属、麦城夷陵悲剧改编口径、配角武将放二期）。
- 顺带坐实两项存量 bug（此前 session_context 为疑似登记，本轮已读码确认）：①`battle.js` finish() 无条件调 `winCampaign()`，而 `store.winCampaign`（store.js:476）仅在 `stage===cleared+1` 时发首通并推进——战败也白拿首通奖励+推关；②`stages.js` 敌将 id `xiahouddun` 陈旧（英雄池现 id 为 `xiahoudun`），21+ 关敌人解析 undefined。两项建议随剧情关卡 P1 一并修复。
- 约束：全程避开 `utils/heroes.js`/`utils/config.js`/ads 等并行会话热点文件；黄巾/南蛮配角武将新增建议放二期与抽卡线统一收口。
- 下一步：用户对方案 5 项拍板后按 P1 范围转实施；拍板前不动代码。

### 存档丢失修复（心跳自动保存） · zcode · 已实施，待验收

时间：2026-09-26；执行者：zcode

用户报告开发者工具里重开小游戏总是回到初始状态。排查结论：存档读写与 v1→v2 迁移逻辑本身无缺陷，病根是**写档时机太薄**——全项目仅 2 个落盘点（app.js 的 onHide 切后台、battle.js 的战斗结算），而开发者工具的「编译」重启是硬重启、不触发 onHide，导致升级/招募/领挂机等日常操作全部不落盘。修复：src/app.js init() 增加 10 秒节流心跳自动保存（setInterval → store.save()，unref 兜底防 Node 离屏渲染进程挂起），丢失窗口压到 10 秒内，真机上与 onHide 双保险。仅改 src/app.js（该文件无并行改动，utils/store.js 等归属并行会话的文件未触碰）。另处置 douyin/ 打包目录污染：__MACOSX 解压垃圾已删，抖音官方模板工程移出为根目录 douyin-template/（未跟踪不入库）。

- 验证：node build.js 同步各 26 文件；node test/smoke.js 361/361；node test/static-check.js 286/286；node preview/mini/record.js 17 画面正常（record 进程不因心跳定时器挂起）。真机/工具复测建议：玩几分钟（不打战斗）→ 编译重启 → 进度保留；「清除全部缓存」仍为重置进度的正确方式。
- 下一步：若并行会话后续在 store.js 落 mutator 级落盘，心跳可保留作双保险；建议长期在 AGENTS.md 明确「存档写入 = 心跳 + onHide + 关键节点」三层约定。
- 依据/文档：src/app.js；utils/store.js（load/save/migrateSaveV1 只读核对）。

### 开发者工具导入包体限制问答（纯问答） · zcode · 无变更

时间：2026-09-26；执行者：zcode

纯问答：确认微信开发者工具「导入项目」与模拟器运行不受包体限制（读本地磁盘，无上传动作）；包体限制只在走上传通道时校验——真机预览、体验版、正式版（微信主包 4M、整包 20M/虚拟支付 30M；抖音主包 4M），与 session_context 既有「体验版包体限制问答」条目一致。对本项目含义：模拟器里可随意加素材调 UI，但每次扫码真机预览前需留意包体（预览也走上传）；当前 26 将程序化立绘+分包方案下余量充足。会话内交付，未改代码。

### 图片上 CDN 与开发者工具访问问答（纯问答） · zcode · 无变更

时间：2026-09-26；执行者：zcode

纯问答：确认微信开发者工具（模拟器跑本机网络）可以直接访问 https CDN；域名白名单只约束 wx.request/uploadFile/downloadFile/connectSocket 四类 API（官方网络使用说明原文），Image 直连远程图片不受白名单限制但受 HTTPS 证书校验；「CDN+本地缓存」方案必然走 wx.downloadFile，须在 mp 后台配置 downloadFile 合法域名（要求 HTTPS、ICP 备案、精确子域名、TLS1.2+）。开发期可在工具「详情→本地设置→不校验合法域名」跳过校验（真机需开调试模式，体验版/正式版必须配白名单）。结合本项目：当前 26 将程序化将魂绘+分包即可承载，CDN 属立绘方案第三层（英雄扩容/高清原画时启用）；落地时双平台白名单分别配置，preview 离屏渲染与 build.js 流程需考虑资源不在包内的兜底。会话内交付，未改代码。

### 装备系统 v1（对标剑与远征：四品质+吃装备升星+阵营加成） · zcode · 已实施，待验收

时间：2026-09-26；执行者：zcode

按用户指令"照抄剑与远征的装备系统，品质分白蓝紫橙（N R SR SSR），先给第一个版本"实施：①`utils/items.js` 重写为四品质 `EQUIP_QUALITIES`（N白/R蓝/SR紫/SSR橙，星上限 1/3/4/5，每星 +10%）；②强化改 AFK 式升星——吃其他装备攒强化点 + 铜钱（`STAR_POINTS`/`FODDER_POINTS`/`GOLD_PER_POINT=40`，一键放入 `fodderPickIds` 由低到高凑点）；③SR/SSR 掉落自带阵营、穿戴同阵营武将属性 +30%（`FACTION_MATCH_MULT`，对标 AFK 对属）；④掉落 `dropQuality` 随进度上移（SSR 4%→7%、SR 12%→19%、R 30%→35%，N 为狗粮）；⑤新增 `salvageBatch` 批量分解白装；⑥存档 v1→v2 迁移（`migrateSaveV1`：旧 tier/enh → q/stars，旧 t6+12 ≈ 新 SSR5★，战力大致连续）；⑦UI：forge 品质筛选行+分道排版卡片（阵营字固定右对齐防挤压）+升星狗粮弹窗、heroDetail 槽位星级大字+阵营匹配金显、battle 掉落文案带品质/阵营；⑧record.js 增 forge-enhance 截图。提交 `eaceb7c` 已推送远程。

- 验证：**提交树自洽验证**——store.js/smoke.js 与并行抽卡会话在同文件纠缠，采用分块暂存（只提交装备 hunk），stash 对方在途改动后跑 `node build.js` + `node test/smoke.js` 146/146 + `node test/static-check.js` 286/286，提交后 stash pop 恢复对方工作区、组合树复跑 smoke 361/361；离屏渲染 18 屏，forge/forge-enhance/hero-detail/battle-result 经两轮视觉验收通过（第一轮发现名称行内联星级+阵营在长组合下会撞按钮区，改分道排版后复审通过）。
- 决定：装备品质体系与英雄稀有度（并行会话已改四档 N/R/SR/SSR）数值解耦，仅共用命名语义；qlmanage 转 PNG 的叠印/emoji/?/金底字虚属转换伪影，验收时已排除。
- 风险/待办：①**发现疑似存量 bug**——battle.js `finish()` 战败也调 `winCampaign()` 发首通奖励并推进 cleared，疑似需加胜利判定（属战斗流程，本轮未动）；②stages.js 第 3 章起 foe 配置引用 heroes 重构后失效的英雄 id（第 21+ 关敌人解析为 undefined，record.js 暂以 cleared=15 绕开，需抽卡会话收口章节配置或 stages 兜底）；③预览管线 SvgCtx 忽略 ctx.scale，截图内容只占左半（存量问题）；④legacy-miniprogram 页面引用旧装备 API 且缺 utils 目录（存量不可运行，按纪律不维护）。
- 下一步：用户验收真机/模拟器体验升星流程与数值手感；数值调优点在 `items.js` 顶部常量（STAR_POINTS/FODDER_POINTS/GOLD_PER_POINT）；后续可按调研报告做套装/词条（第二三步）。

### 小游戏平台变现渠道问答（纯问答） · zcode · 无变更

时间：2026-09-26；执行者：zcode

纯问答：调研微信/抖音之外可走「流量主式」广告分成的分发平台。国内：QQ 小游戏、支付宝小游戏（流量主/灯火 IAA）、百度小游戏（百青藤）、快手小游戏、华为/小米/OPPO/vivo 快游戏（各厂商广告 SDK，激励视频为主力）、4399/233乐园等 H5 联运（联运分成而非广告流量主）。海外网页游戏平台：Poki（广告分成约 50/50）、CrazyGames（广告分成+内购）、Yandex Games（YAN 激励视频，俄区/东欧/中东）、GameDistribution/Playgama HTML5 分发网络（Playgama 分成 70→90% 阶梯）、Telegram Mini Apps（第三方广告网 Adsgram，TON 结算）；Facebook Instant Games 正在关停（官方公告存量网页游戏 2026-09-30 后不再可用），不投入。结合本项目判断：utils/platform.js + src/ads/bridge.js 契约即多平台扩展地基（AGENTS.md「新增平台=复制平台目录+bridge 扩展」路径成立），国内类微信 API 平台（QQ/支付宝）接入成本最低，海外平台需做 Web 版构建+各平台 SDK 的 bridge 实现。会话内交付，未改代码；具体门槛/分成比例随平台政策变动，答复中已注明以官方文档为准。

### 抖音 AppID 接入（测试不发布） · zcode · 已实施，待验收

时间：2026-09-26；执行者：zcode

用户提供真实抖音 AppID `ttdd05abb8437df5b602`，替换 douyin/project.config.json 占位符；build.js 占位符警告随之消失。已给用户交付测试路径：抖音开放平台开发者工具导入 douyin/ 目录 → 模拟器测试 →「预览」扫码真机试玩，不点提审/发布即不对外；测试阶段无需软著/自审等发布资质。另发现工作树中 wechat/project.config.json 有微信开发者工具打开后自动回填的默认配置（setting 补全/isGameTourist 等），已单独 chore 提交；utils/heroes.js 等大改动属并行会话进行中工作，未触碰未提交。

- 验证：node build.js 同步各 26 文件且无占位符警告；node test/smoke.js 361/361（含并行会话新增用例）；node test/static-check.js 286/286。
- 下一步：用户在抖音开发者工具导入 douyin/ 做模拟器+真机预览测试；白屏/报错时把 Console 日志交回排查桥接层；提审发布时再补游戏资质材料（软著/自审报告，无内购不需版号）。
- 依据/文档：douyin/project.config.json；README.md 发布流程表。

### AI 立绘/Q版生成方案问答（纯问答） · zcode · 无变更

时间：2026-09-26；执行者：zcode

纯问答：给出 AI 生成 26 将立绘+Q版的风格一致性方案。核心是三支柱工作流纪律（风格锚点定妆照 + 参考控制 + 模板化批量），路线 A 即梦 Seedream 角色一致性起步（中文 prompt 适配三国、抖音同生态）、路线 B ComfyUI+开源模型（Qwen-Image 等）+风格 LoRA 扩产；含商用授权注意（Flux dev 非商用需避开、平台条款确认、不模仿既有游戏角色造型）与 prompt 模板建议（服装主色沿用 config.FACTIONS 阵营色、职业→服装道具映射表）。会话内交付，未改代码。衔接「抽卡提案」立绘两步走的后半步（程序化将魂绘兜底 → AI 立绘替换）。

### 放置卡牌对战系统调研 · zcode · 需求已交付（纯调研，无代码变更、无新增产品决定）

时间：2026-09-26；执行者：zcode

应用户要求调研放置类卡牌游戏的对战系统（海外 AFK Arena/Journey、Idle Heroes、Hero Wars、Infinity Kingdom + 国内咸鱼之王、寻道大千、小冰冰传奇、三国卡牌、疯狂骑士团），并与本仓库战斗内核逐项比对，产出 `docs/battle-system-research.md`（行业模式、竞品拆解、异步 PvP 专题、玩法矩阵、本项目差距与 P0-P3 分优先级建议，均标注来源与未证实项）。

- 发现（待确认，未改动代码）：① `BATTLE.ENERGY_ATK: 10` 定义于 config 但引擎从未使用——普攻方不回能，怒气几乎只来自挨打，与行业共识（造成伤害是第一回能来源）相反，疑似缺陷；② `strongestEnemy` 实现为打「生命上限最低」而文案（夏侯渊·千里奔袭）写「生命最高」，指向相反。见调研报告 1.3。
- 结论要点：tick 实时能量条内核与小游戏平台最优解（赛前策略、赛中托管）一致，无需换路线；确定性 seed + 事件流是异步 PvP/战报回放的现成地基；演武场目前是种子 NPC 而非异步 PvP；玩法矩阵缺口为伤害竞速 Boss、塔里程碑全局加成。报告基于当日代码快照（heroes/items/store 有并行扩容改造进行中，已在报告注明）。
- 验证：`docs/` 为新增非运行目录，不参与打包（不影响 build.js）；本轮未改 src/utils，未跑 smoke/static-check（无代码变更）。
- 下一步：用户审阅调研报告，决定 P0 两项是否修复、P1-P3 方向取舍。

### 体验版包体限制问答（纯问答） · zcode · 无变更

时间：2026-09-26；执行者：zcode

纯问答：确认体验版/开发版与正式版走同一条上传通道，包体限制完全一致（微信主包 4M、总包 20M/虚拟支付 30M；抖音主包 4M），上传时即校验，超限直接失败；仅开发者工具模拟器本地预览不受限。会话内交付，未改代码。

### 广告桥接层（统一广告 API） · zcode · 已实施，待验收

时间：2026-09-26；执行者：zcode

按用户决策实施广告分层（目标：接真实广告时业务代码零改动、零平台分支）：①新建 `src/ads/bridge.js` 桥接层，自定义统一广告契约 `createRewarded(adUnitId) → { preload(), show() → Promise<{ended}> }`；微信实现 show 优先、失败自动 load→show 重试一次，抖音实现 load 在前（官方推荐、每次 show 前重拉），实例按 adUnitId 单例缓存，未知平台走微信同形实现兜底；②老基础库兼容：show()/load() 不返回 Promise 时同步不抛错即视为已发起、结果走 onClose/onError 事件，此时 onError 才参与失败判定（有 Promise 时 onError 视为同源噪音，不干扰重试——微信 show 失败会 rejection 与 onError 同时出现）；③`src/ads.js` 门面重写 showRewarded 为纯契约消费（.then 发奖/未看完、.catch 拉取失败），场景/频次/模拟广告 UI 不变，对外接口与配置零变化；④smoke 新增 11 项桥接契约用例（现代/老基础库 × 微信/抖音、重试链、onError 噪音门控、单例、终态解绑、无 API 可用性），收尾改异步汇总。与并行调研条目（抽卡/装备/英雄）无文件交集。

- 决定：契约 resolve {ended:true|false} / reject=拉取失败，"平台未回传结果按看完处理"沿袭原行为；桥接层不做超时兜底（沿袭原实现，以平台事件为准）；preload() 已入契约暂不主动调用（留给将来进主城预热）；后续接插屏/横幅或新平台（快手等）只在 bridge 层扩展。
- 验证：node build.js 同步各 26 文件；node test/smoke.js 127/127（116+11 桥接用例）；node test/static-check.js 285/285；node preview/mini/record.js 17 画面正常。开发中契约测试抓出一次真实缺陷（wire 误传 resolve 导致 resolve 布尔而非 {ended}），已修复并用例锁定。
- 下一步：接真实广告时——微信流量主开通后填 AD.rewardedUnitIds.wechat（adunit-xxx 格式），抖音变现开通后填 .douyin（数字 ID），代码零改动；发布上传仍按 wechat/ douyin/ 打包目录各自打开；建议真机各验证一次真实广告拉取（开发者工具无法完整模拟真广告）。
- 依据/文档：src/ads/bridge.js；src/ads.js；test/smoke.js §14；AGENTS.md 架构边界 4；README.md 广告章节。

### 立绘/Q版包体方案问答（纯问答） · zcode · 无变更

时间：2026-09-26；执行者：zcode

纯问答：评估「每将立绘+Q版形象」的包体压力并给出分层方案（资产规范 WebP/尺寸预算 → 分包加载 → 远程 CDN+本地缓存 → 程序化兜底渐进加载），会话内交付，未改代码。结论：26 将按 WebP 预算约 5~6MB，放分包即可承载，暂不需 CDN；英雄扩到 60+ 或引入高清原画/序列帧动画时必须切远程资源。与「抽卡提案」的程序化立绘/粒子动效方向一致。

### 放置卡牌英雄系统调研（纯问答） · zcode · 无变更

时间：2026-09-26；执行者：zcode

应要求调研主流放置卡牌游戏（剑与远征 AFK Arena / 剑与远征：启程 / 三国志幻想大陆 / 咸鱼之王）的英雄系统，会话内交付对标拆解报告。未改任何代码、配置与存档结构；报告结论仅作建议，未形成产品决定。

- 概要：行业通用骨架 = 抽卡获取 × 升星长线 × 共享养成减负 × 阵营/羁绊组队策略；本项目骨架已对齐（环克制/同族 buff/同名+狗粮升星/保底心愿/碎片自选均已实现），主要缺口为缘分羁绊与共鸣水晶式共享养成（R/SR 星级封顶的后期废卡问题）。
- 衔接：与下面两条并行调研互补——「抽卡提案」覆盖获取环节，「装备调研」覆盖装备层；本报告聚焦英雄本体（稀有度/升星/共享养成/缘分羁绊/技能线/重生回退/专武）。三项提案若拍板，utils/config.js 为共同热点文件，须按 AGENTS.md 单 owner 收口。
- 依据：utils/heroes.js、utils/config.js、utils/items.js 现状 + 公开攻略资料（AFK 大圣堂/共鸣水晶/阵营克制、启程等级共享/迷梦/心愿单、三幻无废将/缘分、咸鱼碎片升星/鱼灵/单核献祭）。

### 放置类游戏装备系统调研 · zcode · 无变更

时间：2026-09-26；执行者：zcode

纯调研任务，未改代码/数值/基线。调研对象：剑与远征（AFK Arena，含 wiki 数值）、剑与远征：启程（AFK Journey）、放置奇兵、咸鱼之王、无尽冬日。结论已对话内交付：本项目现有装备系统（4 槽/6 阶/12 级强化/分解/掉落随进度上移，utils/items.js）与 AFK Arena 骨架同构，属最小闭环；主流产品的共同增深层为「重复装备升星 + 套装/阵营绑定（制造配装取舍）+ 减负设计（自动分解/装备共鸣）」，终局再上词条洗练（咸鱼淬炼式）与专属神兵（AFK Journey EX 武器式）。分阶段落地建议已在报告给出，待用户拍板，未实施。

### 抽卡玩法/动效/立绘设计提案 · zcode · 无变更（提案待拍板）

时间：2026-09-26；执行者：zcode

纯设计任务，未改任何代码。调研原神/崩铁、AFK Arena（含莉莉丝官方口径）、微信小游戏生态的抽卡做法后，产出三部分提案：①玩法增强（软保底 45 抽起每抽 +5%、SR 十连保底、心愿单出 SSR 时 60% 权重偏向、重复武将转英魂、概率公示页）；②动效三段式「聚气→流星暗示稀有度→按稀有度递进揭示」，Canvas 2D 粒子实现，单抽 ≤2.5s/十连 ≤4s 可跳过；③立绘两步走（先程序化「将魂绘」0 资源，后 AI 生成+分包加载；约束：主包 ≤4M、总包 ≤20M）。提案全文已在对话中交付用户，待用户逐项拍板。

- 依据：米哈游 0.6% 基础率/74 软保底/90 硬保底/UP 50-50；AFK 系心愿单偏权不保真、阵营卷；稀有度颜色语法（白绿蓝紫金）；微信分包最佳实践。
- 下一步：用户确认方案范围与数值后，按 AGENTS.md 流程转实施（utils/config.js、utils/store.js、src/screens/summon.js 为热点文件，需收口；改完跑 build.js + smoke + static-check）。

### 双平台改造（微信+抖音打包目录） · zcode · 已实施，待验收

时间：2026-09-26；执行者：zcode

按用户指令实现双平台支持：①新建 `utils/platform.js` 平台适配层（全项目唯一引用 wx/tt 的文件，检测优先 tt），`src/app.js`/`src/ads.js`/`utils/store.js` 全部改经适配层取平台 API；②广告位配置改按平台 `AD.rewardedUnitIds`（{wechat, douyin}）；③新建 `src/scenes.js` 集中场景注册，平台入口 `wechat/game.js`、`douyin/game.js` 与离屏渲染共用；④根目录 `game.js`/`game.json`/`project.config.json` 迁入 `wechat/`（微信配置原样保留，去掉不再需要的 packOptions），新建 `douyin/`（game.json 精简为 deviceOrientation+showStatusBar，project.config.json 的 appid 为占位符 `tt0000000000000000` 待用户替换）；⑤新建 `build.js` 双平台同步脚本（整目录重建防残留，--watch 监听，抖音占位 appid 检测提醒）；⑥static-check 升级到 279 项：双平台入口校验、打包目录与共享源码逐文件一致性、共享源码禁止 wx./tt. 直调（platform.js 例外）；⑦record.js 改用 scenes.js 并自行 init+switchTab。

- 决定：打包目录用"生成物 gitignore + 构建脚本同步"方案（而非提交副本），根目录不再是开发者工具项目目录；抖音 game.json 精简为最稳字段（deviceOrientation/showStatusBar），不照搬微信 networkTimeout；广告位 ID 按平台对象配置（两平台广告位 ID 本就不同）；新增平台流程 = 复制平台目录 + 改入口三件 + build.js PLATFORMS 加一行。
- 验证：node build.js 同步各 25 文件 + 占位符提醒正常；node test/smoke.js 116/116；node test/static-check.js 279/279（含平台目录一致性、无平台直调）；node preview/mini/record.js 全部 17 画面渲染正常 + makeview.py 5 个审查页生成（游戏在适配层下完整可跑）。
- 下一步：用户验收——微信开发者工具导入 wechat/ 目录、抖音开发者工具导入 douyin/ 目录各跑一次真机/模拟器预览；发布抖音前把 douyin/project.config.json 的 appid 替换为真实抖音小游戏 AppID；微信侧建议在开发者工具里清缓存重进验证存档建号流程。
- 依据/文档：utils/platform.js；build.js；src/scenes.js；AGENTS.md（已同步更新目录/命令/架构边界/产品决定）；README.md（发布流程表）。

### 项目建档与共享上下文 · zcode · 已实施，待验收

时间：2026-09-26；执行者：zcode

初始化 git 仓库并推送远程：创建 `.gitignore`，提交 129 个文件（`a5516f7`，Initial commit）推送 github.com/gukp1993/tk_afk 的 main 分支并建立跟踪。同日建立 `AGENTS.md`（协作纪律/命令/Git 规则/架构边界）与本共享上下文文件，作为后续多会话/多 agent 协作设施。

- 验证：`git ls-remote` 确认远程 HEAD = a5516f7；`node test/smoke.js` 116/116 通过、`node test/static-check.js` 187/187 通过（建档时复跑）。
- 下一步：后续所有任务按 AGENTS.md 纪律在本文件追加交接条目；如需调整协作规则，直接修订 AGENTS.md 并在本文件记一条「已确认决定」。
