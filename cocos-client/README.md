# 挂机定三国 Cocos Creator 工作区

这个目录是 Cocos Creator 3.8.8 的并行迁移工程。用 Cocos Creator 打开本目录。当前 `Main.scene` + `CocosBootstrap.ts` 只验证引擎场景、UI 绘制、点击和本地存储；画面上的关卡与挂机数字是演示值，不是原游戏的战斗或挂机结算。原 Canvas UI 与玩法尚未移入，现有 `src/`、`utils/`、`wechat/`、`douyin/` 仍是 V1 可运行基线。

从仓库根目录构建 Web 验证包：

```sh
./scripts/cocos-build.sh web-desktop
```

构建微信/抖音小游戏可传 `wechatgame` 或 `bytedance-mini-game`。输出在 `cocos-client/build/<平台>/`，脚本会把对应 V1 平台配置中的 AppID 同步进生成包。CLI 路径默认为 `/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator`，可用 `COCOS_CREATOR_BIN` 覆盖。Cocos Creator 命令行构建需要图形桌面环境。

下一阶段迁移应按内核存档与数值、战斗与关卡、主线和挂机、召唤与养成、双平台适配的顺序实施，并逐项用 V1 行为对照。当前生成包只能验证 Cocos 技术链路，不能作为 V2 玩法包发布。
