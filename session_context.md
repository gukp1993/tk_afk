# tk_afk 共享上下文（挂机定三国 · 微信小游戏）

> 本文件是跨会话、跨执行者（zcode / codex / 其他 harness）的共享上下文，按 `AGENTS.md`「共享上下文交接」纪律维护：**开工先读本文件；收工在「最近交接」最上方追加本轮条目**。只新增不删改，纠错追加新记录。"已实施"不等于"已验收"，同一任务双方结论分开展示。

## 当前有效基线（2026-09-26 核对）

- 项目：三国放置卡牌微信小游戏（Canvas 渲染），玩法对标 AFK Arena；AppID `wx03eb4074ce45033b`，compileType=game。
- 仓库：远程 `github.com/gukp1993/tk_afk`（SSH 推送，分支 main）；本地 `/Users/gukepeng/Desktop/ai/miniProgram/tk_afk`。
- 技术形态：原生 JS，无构建步骤、无 npm 依赖。`utils/` 内核纯 JS 双版共用（小游戏版 + legacy-miniprogram 旧版）；`src/` 为 Canvas IMGUI 表现层，场景在 `src/screens/`。
- 验证命令：`node test/smoke.js`（116 项）、`node test/static-check.js`（187 项）；离屏渲染审查 `node preview/mini/record.js` + `python3 preview/mini/makeview.py`。
- 广告为测试模式（内置模拟广告）；正式变现待流量主开通后填 `AD.rewardedUnitId`，代码零改动切换。
- 存档 key `sanguo_afk_save_v1`（wx.setStorageSync）；改存档结构必须向后兼容旧档。
- 打包排除 preview/、test/、legacy-miniprogram/、README.md（`project.config.json` 的 packOptions.ignore）。
- `.gitignore`：`.DS_Store`、`project.private.config.json`、`node_modules/`、`*.log`、`*.tmp`。
- 2026-09-26 初始提交 `a5516f7` 已推送远程（129 文件）；协作设施 `AGENTS.md` 与本文件已建立。

## 最近交接（新 → 旧）

### 项目建档与共享上下文 · zcode · 已实施，待验收

时间：2026-09-26；执行者：zcode

初始化 git 仓库并推送远程：创建 `.gitignore`，提交 129 个文件（`a5516f7`，Initial commit）推送 github.com/gukp1993/tk_afk 的 main 分支并建立跟踪。同日建立 `AGENTS.md`（协作纪律/命令/Git 规则/架构边界）与本共享上下文文件，作为后续多会话/多 agent 协作设施。

- 验证：`git ls-remote` 确认远程 HEAD = a5516f7；`node test/smoke.js` 116/116 通过、`node test/static-check.js` 187/187 通过（建档时复跑）。
- 下一步：后续所有任务按 AGENTS.md 纪律在本文件追加交接条目；如需调整协作规则，直接修订 AGENTS.md 并在本文件记一条「已确认决定」。
