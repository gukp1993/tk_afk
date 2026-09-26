# tk_afk 共享上下文（挂机定三国 · 微信/抖音双平台小游戏）

> 本文件是跨会话、跨执行者（zcode / codex / 其他 harness）的共享上下文，按 `AGENTS.md`「共享上下文交接」纪律维护：**开工先读本文件；收工在「最近交接」最上方追加本轮条目**。只新增不删改，纠错追加新记录。"已实施"不等于"已验收"，同一任务双方结论分开展示。

## 当前有效基线（2026-09-26 核对）

- 项目：三国放置卡牌小游戏（Canvas 渲染），玩法对标 AFK Arena；**微信 + 抖音双平台**（2026-09-26 起）。微信 AppID `wx03eb4074ce45033b`；抖音 AppID 占位符待用户替换。
- 仓库：远程 `github.com/gukp1993/tk_afk`（SSH 推送，分支 main）；本地 `/Users/gukepeng/Desktop/ai/miniProgram/tk_afk`。
- 技术形态：原生 JS，无 npm 依赖。共享源码 `src/`（表现层）+ `utils/`（内核，`platform.js` 为唯一 wx/tt 适配层）；`build.js` 把共享源码同步进打包目录 `wechat/`（微信开发者工具打开）与 `douyin/`（抖音开发者工具打开），打包目录内 src/utils 是 gitignore 的生成物。
- 验证命令：`node build.js`（打包同步，发布前必跑）、`node test/smoke.js`（127 项，含广告桥接契约）、`node test/static-check.js`（285 项，含双平台入口/打包目录一致性/平台 API 收口）；离屏渲染审查 `node preview/mini/record.js` + `python3 preview/mini/makeview.py`。
- 广告分两层：`src/ads.js` 业务门面（零平台分支）+ `src/ads/bridge.js` 桥接层（统一 `show() → Promise<{ended}>` 契约，微信/抖音接入差异收口）；当前测试模式（内置模拟广告），正式变现按平台填 `AD.rewardedUnitIds`（{wechat, douyin}）即切真广告。
- 存档 key `sanguo_afk_save_v1`（平台存储，两平台相互独立）；改存档结构必须向后兼容旧档。
- 根目录不再是开发者工具项目目录（入口文件已迁入 `wechat/`）；`legacy-miniprogram/` 旧版微信小程序存档参考，不参与打包。
- `.gitignore`：`.DS_Store`、`project.private.config.json`、`node_modules/`、`*.log`、`*.tmp`、`/wechat/src|utils/`、`/douyin/src|utils/`。
- 2026-09-26 初始提交 `a5516f7`、双平台改造提交已推送远程；协作设施 `AGENTS.md` 与本文件已建立。

## 最近交接（新 → 旧）

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
