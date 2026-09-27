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
scripts/cocos-sync-domain.js        更新并检查规则镜像
scripts/cocos-build.sh              调用 Creator CLI 构建
scripts/cocos-sync-appid.js         同步两平台 AppID
```

规则的唯一编辑源仍是 `utils/`；Cocos 页通过静态导入使用生成的 TS 镜像。生成的文件带 `@ts-nocheck`，因为源文件是经过旧版测试的原生 JS；手写的 Cocos 层由 Creator 自带 TypeScript 编译器检查。存档 key 沿用 `sanguo_afk_save_v1`，小游戏平台走 `wx/tt` 存储，Web 预览走 localStorage。战斗过程仅更新已有武将文本与血条节点，不再每 0.3 秒销毁并重建整屏节点。旧 `src/`、`wechat/`、`douyin/` 在迁移验收前保留作行为和画面对照，不参与 Cocos 打包。

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

本轮 UI 对照以 `wechat/` 的战役、主城、点将台、群英录、英雄详情、剧情、战斗和结算为基线，Cocos 画面在 Web 预览中逐页检查。主城已接入道路、六个建筑、快捷任务/背包、推图与挂机操作；旧版绘景被转为 Cocos 原生 Graphics，不依赖运行时 Canvas 或外部美术包。页面导航与旧版五个主标签对齐；王庭、集市等子页使用各自资源栏，返回路径保持来源页。背包、王庭玩法入口、编队、军械总览、塔和演武场改为旧版的卡片与站位结构。功能与信息层级已接近原页，但字体、间距和局部动效仍未达到逐像素一致。

当前 Cocos 包**不是已验收的上架版本**。Web 预览覆盖了关卡预览、剧情、战斗胜利/跳过/退出后重试、下一关、自动停止摘要、连续练兵、招募结果直达详情、模拟广告、编队换将与军械解锁/启用/自选箱。本轮实点战役、群英筛选与滚动详情、王庭、塔、演武、背包到集市、编队换将、召唤、战斗跳过与结算，浏览器控制台无脚本错误。微信开发者工具 iPhone 17 模拟器已显示新主线地图和五个主标签，场景加载成功且控制台未见运行错误；最终重构建后的包仍需点编译并逐页实点。抖音开发者工具 4.5.6 的 iPhone 15 Pro 模拟器此前从新档实际进入主线，开战、跳过并领取结算奖励；本轮新 UI 尚未在该模拟器复验。两平台真机尚未验收。旧工程仍保留作功能与画面对照。

## 校验

```bash
node scripts/cocos-sync-domain.js --check
node /Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/bin/tsc --noEmit --pretty false
node test/smoke.js
node test/static-check.js
./scripts/cocos-build.sh web-mobile
./scripts/cocos-build.sh wechatgame
./scripts/cocos-build.sh bytedance-mini-game
```

Creator CLI 使用本机安装路径；若 Creator 装在别处，可通过 `COCOS_CREATOR_BIN` 指定可执行文件。更换 Creator 版本后，应先重新生成 `temp/tsconfig.cocos.json` 再执行类型检查。

小游戏命令默认使用 `debug=false` 的发布构建；微信包当前目录约 3.1 MB、抖音包约 3.5 MB（微信调试构建约 6.3 MB），AppID 与旧平台配置一致。Cocos [微信小游戏发布文档](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-wechatgame.html)列出的主包上限为 4 MB。实际上传结果仍以平台开发者工具/后台校验为准。
