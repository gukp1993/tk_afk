# Cocos Creator 迁移与架构状态（2026-09-27）

## 工程入口

仓库根目录就是 Cocos Creator 3.8.8 项目，不再使用 `cocos-client/`。Creator 打开根目录；启动场景为 `assets/scene/Main.scene`。微信、抖音构建产物分别在 `build/wechatgame/`、`build/bytedance-mini-game/`，均为可重新生成的目录。

```
assets/scene/Main.scene             启动场景
assets/scripts/CocosBootstrap.ts    生命周期、导航、战斗执行、交互弹窗
assets/scripts/screens/            战役/主城、英雄/召唤/军械、战斗/结算页面
assets/scripts/ui/CocosUi.ts        原生 Node + Graphics + Label、ScrollView/Mask 控件
assets/scripts/ui/Scenery.ts        从 wechat/ 原创 Canvas 构图迁来的 Cocos Graphics 山水/城镇/营地
assets/scripts/services/           自动战斗会话、广告门面与桥接
assets/scripts/domain/             从旧 utils/ 生成的规则与存档镜像；只手写 platform.ts
scripts/rewarded-bridge.js          生成 Cocos RewardedBridge.ts 的平台桥接源码
scripts/cocos-appids.json           微信/抖音 Cocos 构建使用的 AppID
scripts/cocos-sync-domain.js        更新并检查规则镜像
scripts/cocos-build.sh              调用 Creator CLI 构建
scripts/cocos-sync-appid.js         同步两平台 AppID
```

规则的唯一编辑源仍是 `utils/`；Cocos 页通过静态导入使用生成的 TS 镜像。生成的文件带 `@ts-nocheck`；手写的 Cocos 层由 Creator 自带 TypeScript 编译器检查。广告桥接由 `scripts/rewarded-bridge.js` 生成，平台 AppID 位于 `scripts/cocos-appids.json`。存档 key 沿用 `sanguo_afk_save_v1`，小游戏平台走 `wx/tt` 存储，Web 预览走 localStorage。战斗过程仅更新已有武将文本与血条节点，不再每 0.3 秒销毁并重建整屏节点。旧 Canvas 源码、微信/抖音旧打包目录、旧预览工具和旧自动化测试已按用户指令删除。

## 功能对照

| 系统 | Cocos 当前实现 | 尚需收口 |
|---|---|---|
| 战役主线 | 按 `wechat/` 战役页重建章节栏、山河路线、城寨、五面关卡旗、出战营地、挂机宝箱与三按钮操作区；十关章节地图、关卡预览、当前敌阵、首通奖励、真实 5v5 战斗、跳过、手动退出与下一关结算 | 战斗伤害飘字和技能演出 |
| 自动出征 | 共用旧版状态机；连续推关、失败后有限练兵、手动预约停止、停止摘要 | 失败恢复路径的 Cocos 实机回归；跨页停/续交互细节 |
| 挂机 | 离线累计、普通/双倍领取、快速收获与确认 | 长离线、跨日、真机前后台验收 |
| 招募 | 对照旧点将台补齐资源栏、概率/武将池、三种招募按钮与广告入口；资源确认、固定概率规则、十张结果卡、重复卡自动升星、结果卡直达武将详情 | 抽卡演出、详细卡池说明和细致反馈 |
| 英雄/编队 | 群英三列可滚动卡片、阵营与排序筛选、武将详情属性技能、同名卡保护、自选券、2 后排 + 3 前排编队与滚动换将/互换 | 个别武将详情说明与原页排版仍需逐项对齐 |
| 共享军械 | 对照旧版改为六部位双列卡片；保留图鉴解锁/启用、部位升星、里程碑自选箱 | 图鉴条目和自选箱页仍是列表；推荐装备展示和详细属性 |
| 日常与玩法 | 背包资源双列卡、王庭四入口、塔/演武场面板与实际对手数据、每日任务/活跃箱、集市、练兵；长列表由原生 ScrollView 裁剪和拖动 | 部分副玩法提示、军械图鉴和自选箱页的细节仍需逐项对齐 |
| 广告 | 与旧版同契约的真实广告桥接；未配广告位时三秒测试广告，提前关闭不发奖；可用入口为挂机双倍、免费收获与免费招募 | 微信/抖音开发者工具及真机广告验证；旧版禁用的失败复活入口保持禁用 |

本轮 UI 实施时曾以旧版战役、主城、点将台、群英录、英雄详情、剧情、战斗和结算为基线；旧版目录现已按用户指令清理，Cocos 画面在 Web 预览中逐页检查。主城已接入道路、六个建筑、快捷任务/背包、推图与挂机操作；旧版绘景被转为 Cocos 原生 Graphics，不依赖运行时 Canvas 或外部美术包。页面导航与旧版五个主标签对齐；王庭、集市等子页使用各自资源栏，返回路径保持来源页。背包、王庭玩法入口、编队、军械总览、塔和演武场改为旧版的卡片与站位结构。后续对照旧版离屏截图，统一楷体与深棕背景，调整群英资源栏/筛选、武将头像、详情页可视区域、点将台和编队的纵向布局。功能与信息层级已接近原页，但局部间距和动效仍未达到逐像素一致。

当前 Cocos 包**不是已验收的上架版本**。Web 预览覆盖了关卡预览、剧情、战斗胜利/跳过/退出后重试、下一关、自动停止摘要、连续练兵、招募结果直达详情、模拟广告、编队换将与军械解锁/启用/自选箱。本轮实点战役、群英筛选与滚动详情、王庭、塔、演武、背包到集市、编队换将、召唤、战斗跳过与结算，浏览器控制台无脚本错误。最终微信构建包在微信开发者工具 iPhone 17 模拟器显示群英录，实点底部英雄标签及武将卡进入详情，场景加载成功且控制台未见游戏运行错误；模拟器后续自动化点击超时，因此未继续宣称逐页验收。抖音开发者工具 4.5.6 的 iPhone 15 Pro 模拟器此前从新档实际进入主线，开战、跳过并领取结算奖励；本轮新 UI 尚未在该模拟器复验。两平台真机尚未验收。旧工程已清理；本文件记录的旧版差异只供追溯。

## 校验

```bash
node scripts/cocos-sync-domain.js --check
node /Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/bin/tsc --noEmit --pretty false
./scripts/cocos-build.sh web-mobile
./scripts/cocos-build.sh wechatgame
./scripts/cocos-build.sh bytedance-mini-game
```

Creator CLI 使用本机安装路径；若 Creator 装在别处，可通过 `COCOS_CREATOR_BIN` 指定可执行文件。更换 Creator 版本后，应先重新生成 `temp/tsconfig.cocos.json` 再执行类型检查。

小游戏命令默认使用 `debug=false` 的发布构建；AppID 与旧平台配置一致。Cocos [微信小游戏发布文档](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-wechatgame.html)列出的主包上限为 4 MB。实际上传结果仍以平台开发者工具/后台校验为准。

## 轻量占位美术轮（2026-09-27 实施）

按 `docs/wechat-placeholder-art-plan-v1.md` 实施完毕，抖音未构建、未改动。

- **占位组件**：`CocosUi.ts` 新增 `heroIcon()`（阵营底色 + 品质描边 + 姓氏 + 未获得压暗/上阵“战”徽标）与 `seal()`（几何图章，替代钱/宝/阵/属性/技能/军械/导航图标），删除了 `sprite()`、`clippedSprite()` 与 Graphics 版 `portrait()`。阵营色与品质色集中在 `factionColors`/`rarityColors` 导出。所有页面（群英录、详情、招募结果、编队/选将、集市自选、首胜弹窗、底部导航）共用这一套样式；未来恢复立绘只需重写 `heroIcon` 内部实现。
- **详情页收紧**：原 700 高立绘展示区收缩为 260 高横排头部（左 170×220 图标 + 右称号/名字/阵营职业/品质/星级），属性、技能进入首屏；滚动内容基础高度 1740 → 1160。
- **资源清理**：全局检索确认无残留引用后，删除 `assets/resources/hero-ui/` 全部 14 张 PNG（10 立绘 + 关羽全身 + 城关背景 + 3 图集）与 `.meta`，删除 `assets/scripts/services/HeroUiAssets.ts`；设计原件保留在 `docs/hero-ui-handoff-v1/`。
- **包体**（`du -sk` 同口径）：构建前 `build/wechatgame` 35984 KB（其中 assets/resources 32768 KB，最大文件全是立绘）；构建后 3224 KB（assets 448 KB），减少约 32 MiB / 91%，包内仅剩引擎 logo/slogan 两张小图，主包低于 4 MB 上限。构建后最大文件为 2.3 MB 的引擎 bundle，非美术资源。
- **验证**：`cocos-sync-domain.js --check`、`tsc --noEmit` 通过；单次 `wechatgame` 构建（`nice -n 15`）成功。用 Web 预览 + 无头 Chrome 实点回归：新档走 战役→群英录→详情→返回→召唤→招募×1→结果→查看群英→编队换将，旧档（删 armory/vouchers/heroProgress/battle 四字段重载）走 战役→群英录→详情→编队→选将，两条链路页面渲染正常、无缺图/空白大框/触摸热区错位，浏览器控制台除无害的 favicon 404 外零错误、零 pageerror（实施中曾出现 Graphics 与 Label 同节点冲突导致“战”徽标文字丢失，已改为子节点修复）。
- **待验收**：微信开发者工具（新档/已有档实点、控制台）与真机尚未复验本轮 UI；首建号实际赠送 5 将（含孟达），与 AGENTS.md 记载的 4 将不符，待与产品决定核对。
