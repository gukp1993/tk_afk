# Cocos Creator 迁移与架构状态（2026-09-27）

## 工程入口

仓库根目录就是 Cocos Creator 3.8.8 项目，不再使用 `cocos-client/`。Creator 打开根目录；启动场景为 `assets/scene/Main.scene`。微信、抖音构建产物分别在 `build/wechatgame/`、`build/bytedance-mini-game/`，均为可重新生成的目录。

```
assets/scene/Main.scene             启动场景
assets/scripts/CocosBootstrap.ts    生命周期、导航、战斗执行、交互弹窗
assets/scripts/screens/            战役/主城、英雄/召唤/军械、战斗/结算页面
assets/scripts/ui/CocosUi.ts        原生 Node + Graphics + Label 控件
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
| 战役主线 | 章节/关卡、当前敌阵与关卡预览、首通奖励、路线旗帜、编队展示和快捷入口；真实 5v5 战斗、跳过、手动退出中断与下一关结算 | 完整章节地图、战斗演出与旧版画面密度 |
| 自动出征 | 共用旧版状态机；连续推关、失败后有限练兵、手动预约停止、停止摘要 | 失败恢复路径的 Cocos 实机回归；跨页停/续交互细节 |
| 挂机 | 离线累计、普通/双倍领取、快速收获与确认 | 长离线、跨日、真机前后台验收 |
| 招募 | 单抽/十连、资源确认、固定概率规则、十张结果卡、重复卡自动升星、结果卡直达武将详情 | 演出、结果筛选和细致反馈 |
| 英雄/编队 | 群英分页、属性技能、同名卡保护、自选券、五位置编队与换将/互换 | 英雄筛选和详细阵容提示 |
| 共享军械 | 六部位、图鉴解锁/启用、部位升星、里程碑自选箱 | 推荐装备展示和详细属性 |
| 日常与玩法 | 背包资源、每日任务/活跃箱、集市、群英塔、演武场、练兵 | 副玩法的信息层级与完整提示 |
| 广告 | 与旧版同契约的真实广告桥接；未配广告位时三秒测试广告，提前关闭不发奖；可用入口为挂机双倍、免费收获与免费招募 | 微信/抖音开发者工具及真机广告验证；旧版禁用的失败复活入口保持禁用 |

当前 Cocos 包**不是已验收的上架版本**。Web 预览覆盖了关卡预览、战斗胜利/跳过/退出后重试、下一关、自动停止摘要、连续练兵、招募结果直达详情、模拟广告、编队换将与军械解锁/启用/自选箱。抖音开发者工具 4.5.6 的 iPhone 15 Pro 模拟器已从新档实际进入主线，开战、跳过并领取结算奖励；控制台只有首次缺少 `gamecaches/cacheList.json` 的引擎缓存警告，未见游戏脚本错误。微信开发者工具和两平台真机尚未验收。旧版视觉和少数交互尚未完全迁入，因此旧工程不能在此时删除。

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
