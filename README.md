# 挂机定三国（三国放置卡牌 · 微信/抖音双平台小游戏）

## Cocos Creator 主工程（迁移进行中）

仓库根目录 `tk_afk/` 即 Cocos Creator 3.8.8 项目，直接用 Creator 打开此目录；`assets/scene/Main.scene` 是启动场景。`assets/scripts/CocosBootstrap.ts` 负责生命周期、导航与战斗执行，`assets/scripts/screens/` 按玩法页面渲染 Cocos 节点，`ui/` 提供原生节点控件，`services/` 管自动战斗和广告。`scripts/cocos-sync-domain.js` 从现有 `utils/` 生成 Cocos 的规则模块，保持存档 key 和玩法计算一致；生成模块不要手改。Cocos 生成文件位于根目录 `build/`、`library/`、`temp/`，均不入库。

```bash
./scripts/cocos-build.sh web-desktop
./scripts/cocos-build.sh web-mobile
./scripts/cocos-build.sh wechatgame
./scripts/cocos-build.sh bytedance-mini-game
```

微信、抖音 Cocos 包在 `build/wechatgame/`、`build/bytedance-mini-game/`。构建脚本从 `scripts/cocos-appids.json` 读取 AppID。目前已接入真实存档、主线战斗、自动出征与练兵、挂机、召唤、英雄、共享军械、集市、塔和演武的基础入口；抖音开发者工具模拟器已验证主线首战与结算，微信开发者工具和两平台真机仍需验收。画面与完整交互仍在对照迁移。旧版 `build.js`、`assets_gen/`、`legacy-miniprogram/`、`preview/`、`test/`、`src/`、`wechat/`、`douyin/` 已删除。

小游戏默认执行发布构建以缩减主包，Web 默认调试构建；需要排查小游戏时可用 `COCOS_DEBUG=true ./scripts/cocos-build.sh wechatgame` 临时覆盖。打包后仍须检查实际主包大小及开发者工具提示。

## 旧 Canvas 基线

以下内容保留旧版技术与玩法说明；部分早期养成数值已被 V2 调整，当前行为以 `utils/` 内规则和 `docs/cocos-migration-status.md` 的迁移对照为准。

一款以三国为背景的卡牌放置类**小游戏**（Canvas 渲染），同时支持**微信小游戏**与**抖音小游戏**双平台，
玩法骨架对标《剑与远征》(AFK Arena) 的核心循环。所有武将、技能、文案、视觉均为原创三国题材内容
（历史人物为公版素材，未使用任何第三方游戏的美术或文本资产）。

- 微信 AppID：`wx03eb4074ce45033b`（**小游戏类账号**，与项目类型匹配）
- 抖音 AppID：`ttdd05abb8437df5b602`
- 平台差异由 `utils/platform.js` 适配层收口（wx / tt 唯一入口），游戏代码零平台分支
旧 Canvas 打包同步流程已删除。Cocos 包请使用上方 `scripts/cocos-build.sh` 命令生成。

首次进入自动建号：赠送 刘备(SSR)、关羽(SSR)、张飞(SSR)、廖化(N) + 1888 元宝 + 12 招募令。
主城点「出征」开打；挂机收益实时累计，记得「一键领取」。

## 核心系统（对标 AFK Arena 逐项复刻）

| 系统 | 说明 |
|---|---|
| 挂机收益 | 按最高通关进度产出铜钱/兵书/招募令，离线上限 12 小时；快速收获 +2h（50 元宝，每日 6 次） |
| 战役 | 12 章演义剧情主线（黄巾之乱 → 星落五丈原，对标《三国演义》名场面）：每关事件名+战前旁白/名将关对白（打字机弹层，可跳过），章末宝箱；之后无限乱世循环章 |
| 阵营克制 | 魏→蜀→吴→群→魏 循环克制，克制方伤害 +25%；同阵营 3/4/5 人全队加成 |
| 共鸣水镜 | 等级前五的武将决定共鸣等级，其余武将自动共享（AFK 共鸣水晶机制） |
| 升阶 | 同名卡 + 同阵营兵魂点（R/SR/SSR=1/2/4 点）+ 铜钱；R★3 / SR★4 / SSR★5，升阶提高等级上限 |
| 英雄重置 | 非共鸣核心武将可重置等级，返还 70% 资源；遣散返还碎片与铜钱 |
| 点将台 | 招募令单抽/十连、元宝十连 2880；120 将池按四档固定概率招募（SSR 2% / SR 10% / R 28% / N 60%），无保底 |
| 战斗 | 5v5 实时自动战斗：怒气大招、流血/灼烧/中毒、护盾、眩晕/冰冻、吸血/反弹、斩杀、免死；×1/×2/×4 加速、跳过、飘字/大招横幅/震屏闪光 |
| 装备 | 兵刃/铠甲/头盔/战靴 × 六品阶（凡铁→神兵），战役掉落，强化 +12，可穿戴/分解 |
| 群英塔 | 无限爬塔，每 5 层名将坐镇，首通得元宝/招募令/碎片 |
| 演武场 | 每日 5 次，三名按我方战力生成对手；积分段位（新兵→大将军），胜得演武令 |
| 集市 | 每日限购；演武令/碎片兑换招募令与自选 SR/SSR 卡 |
| 每日军令 | 6 项任务 + 活跃度宝箱（40/70/100），每日刷新 |
| 激励视频广告 | 4 个场景接入，当前为**测试模式**（内置模拟广告，流程完整可玩），详见下节 |

## 激励视频广告（测试模式）

Cocos 广告服务使用 `utils/config.js` 中的 `AD.placements` 配置每日上限：

| 场景 | 效果 | 每日上限 |
|---|---|---|
| 主城 · 看广告 ×2 领取 | 本次挂机收益双倍 | 3 |
| 主城 · 看广告 +2h | 免费快速收获（省 50 元宝） | 3 |
| 点将台 · 看广告得招募令 | 招募令 ×1 | 1 |
| 战斗结算 · 复活再战 | 败北后全队以 30% 血量再战同关 | 1 |

**双模式设计**：
- `AD.rewardedUnitIds` 对应平台为空（当前）：点击按钮播放**内置模拟广告**（3 秒倒计时 → 领取奖励），开发者工具/体验版/真机都能完整验证流程与每日次数；
- 正式变现：微信开通流量主（UV≥1000）→ 创建激励视频广告位 → 把 `adunit-xxx` 填入 `AD.rewardedUnitIds.wechat`；抖音开通变现后同理填 `AD.rewardedUnitIds.douyin`。各平台按钮自动切换为真广告，代码无需再改。

**平台接入分层**：业务代码只调统一接口，平台差异由 `scripts/rewarded-bridge.js` 提供，Cocos 构建时复制生成到 `assets/scripts/services/RewardedBridge.ts`。`show()` 永远返回 `Promise<{ended}>`；微信实现 show 优先、失败自动重拉一次，抖音实现 load 在前，老基础库不返回 Promise 时走事件回调。旧版广告桥接测试已删除，当前修改后按 Cocos 类型检查与构建命令检查。

广告计数随存档每日重置；提前关闭模拟广告或 `isEnded === false` 时不发奖。

## 架构

```
assets/scene/Main.scene         Cocos 启动场景
assets/scripts/                 Cocos 启动、页面、服务、UI 和规则镜像
utils/                          规则源，生成到 assets/scripts/domain/
scripts/rewarded-bridge.js      Cocos 广告桥接生成源
scripts/cocos-appids.json      微信/抖音小游戏 AppID 配置
scripts/                        Cocos 构建、规则同步、AppID 同步脚本
build/                          Cocos 构建输出（git 忽略，可重新生成）
library/、temp/、profiles/      Creator 缓存/本机配置（git 忽略）
```

内核（`utils/`）为纯 JS：可播种随机数的战斗引擎、存档、挂机、固定概率招募等，通过平台适配层访问小游戏平台能力。

## 数据与存档

- 存档经平台存储持久化（微信 `wx.setStorageSync` / 抖音 `tt.setStorageSync`，经 Cocos 平台适配层访问；key：`sanguo_afk_save_v1`），切后台自动保存。两平台存档相互独立。
- 开发者工具「清除缓存」即可重置进度。
