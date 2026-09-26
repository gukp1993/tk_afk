# tk_afk 共享上下文（挂机定三国 · 微信小游戏）

> 本文件是跨会话、跨执行者（zcode / codex / 其他 harness）的共享上下文，按 `AGENTS.md`「共享上下文交接」纪律维护：**开工先读本文件；收工在「最近交接」最上方追加本轮条目**。只新增不删改，纠错追加新记录。"已实施"不等于"已验收"，同一任务双方结论分开展示。

## 当前有效基线（2026-09-26 核对）

- 项目：三国放置卡牌小游戏（Canvas 渲染），玩法对标 AFK Arena；**微信 + 抖音双平台**（2026-09-26 起）。微信 AppID `wx03eb4074ce45033b`；抖音 AppID 占位符待用户替换。
- 仓库：远程 `github.com/gukp1993/tk_afk`（SSH 推送，分支 main）；本地 `/Users/gukepeng/Desktop/ai/miniProgram/tk_afk`。
- 技术形态：原生 JS，无 npm 依赖。共享源码 `src/`（表现层）+ `utils/`（内核，`platform.js` 为唯一 wx/tt 适配层）；`build.js` 把共享源码同步进打包目录 `wechat/`（微信开发者工具打开）与 `douyin/`（抖音开发者工具打开），打包目录内 src/utils 是 gitignore 的生成物。
- 验证命令：`node build.js`（打包同步，发布前必跑）、`node test/smoke.js`（116 项）、`node test/static-check.js`（279 项，含双平台入口/打包目录一致性/平台 API 收口）；离屏渲染审查 `node preview/mini/record.js` + `python3 preview/mini/makeview.py`。
- 广告为测试模式（内置模拟广告）；正式变现按平台填 `AD.rewardedUnitIds`（{wechat, douyin}），代码零改动切换。
- 存档 key `sanguo_afk_save_v1`（平台存储，两平台相互独立）；改存档结构必须向后兼容旧档。
- 根目录不再是开发者工具项目目录（入口文件已迁入 `wechat/`）；`legacy-miniprogram/` 旧版微信小程序存档参考，不参与打包。
- `.gitignore`：`.DS_Store`、`project.private.config.json`、`node_modules/`、`*.log`、`*.tmp`、`/wechat/src|utils/`、`/douyin/src|utils/`。
- 2026-09-26 初始提交 `a5516f7`、双平台改造提交已推送远程；协作设施 `AGENTS.md` 与本文件已建立。

## 最近交接（新 → 旧）

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
