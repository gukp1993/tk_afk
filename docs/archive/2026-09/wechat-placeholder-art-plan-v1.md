# 微信小游戏轻量占位美术开发方案 v1

状态：实施方案，尚未改运行代码或重构建。目标平台仅为微信小游戏；抖音不在本轮开发、构建和验收范围。

## 目标与现状

先用清晰、统一的图标占位，不再使用武将立绘和大幅背景，让主线推关、招募、挂机的玩法调试不被美术制作和包体拖慢。保留阵营、品质、星级和上阵状态的辨识度，玩家仍能快速看懂卡片。

2026-09-27 本地只读统计：`build/wechatgame/` 目录约 35 MiB，`assets/resources/hero-ui/` 的十张立绘共约 25.8 MiB、一张城关背景约 2.17 MiB、三张图集约 3.89 MiB；这些资源都已进入微信生成包。这里是磁盘目录大小，不是平台最终上传压缩体积。预期移除上述运行图片后，本地微信生成目录降至约 3–5 MiB；**以重构建后的实际结果为准**。缩小 Sprite 在屏幕上的显示尺寸不会减少包体。

## 本轮范围

1. **统一占位组件**：在 `assets/scripts/ui/CocosUi.ts` 增加一个可复用的武将图标绘制接口，接收姓名、阵营、品质、是否已获得/上阵和尺寸。用 Cocos `Graphics`/`Label` 绘制阵营底色、品质描边、姓氏文字与状态标识。小卡片用约 64–80 的图标；详情页用约 140–180 的放大版。所有页面共用一套样式，未来若恢复立绘，只替换这个接口的内部实现。
2. **替换页面引用**：在 `assets/scripts/screens/HeroScreens.ts` 去掉 `portraitIds`/`portraitAsset` 和 `background_fortress`、立绘、卡框大图的调用。群英录、未获得卡、武将详情和招募结果使用统一图标；详情页原 700 高的展示区收缩为约 220–280，让属性、技能更早进入首屏。检查 `assets/scripts/screens/CampaignScreens.ts` 的编队/选将卡，以及 `assets/scripts/CocosBootstrap.ts` 的底部导航，统一成小图标或文字标记。资源、阵营、技能、军械图标可用简洁几何图形加文字，不需要再生产独立高清 PNG。
3. **清理运行资源**：先全局检索 `sprite(`、`clippedSprite(`、`loadHeroSpriteFrame`、`portrait_`、`hero_guanyu_full` 和 `background_fortress`，确认替换完全部调用，再移除 `assets/resources/hero-ui/` 中的 14 张 PNG 及其 `.meta`。这批立绘、图集、背景的设计原件已在 `docs/hero-ui-handoff-v1/` 下，**不要删除文档原件**。若无调用者，删除 `assets/scripts/services/HeroUiAssets.ts` 及 `CocosUi` 中专为该资源映射服务的加载逻辑；如要保留图片加载能力，也不能留下对已移除资源的引用。不要手改 `build/`。
4. **保持玩法不变**：不改 `utils/` 数值、抽卡概率、存档结构、战斗规则与奖励。新旧存档中的武将都要能显示，占位图标只是表现层变化。

## 验收标准

- 群英录、武将详情、招募结果、编队/选将、底部导航和相关弹层都没有缺图、空白大框或触摸热区错位；阵营、品质、星级、上阵/未获得状态仍清楚。详情首屏能看到至少一组有效玩法信息（属性或技能），不保留原先立绘的大面积空位。
- 全局检索确认不再引用已移除的资源 ID；`assets/resources/hero-ui/` 不留上述大图；`docs/` 中原始设计素材仍在。微信生成包中不再包含这 14 张大图，记录构建前后**同口径**的目录字节数与最大文件列表。
- 规则镜像检查、TypeScript 检查通过；只做微信小游戏构建。微信开发者工具中从新档和已有档分别检查英雄列表→详情→返回、召唤结果、编队换将，并查看控制台错误。实际包体与视觉验收结果写入 `docs/cocos-migration-status.md`；构建成功本身不等于页面验收。

## 执行顺序与命令

按“组件和页面替换 → 全局引用审查 → 删除运行资源 → 静态检查 → 单次微信构建 → 开发者工具实看”的顺序执行。先改完、查完再构建，避免反复启动 Creator 加重电脑负载；不要运行抖音构建。

```bash
rg -n 'portrait_|hero_guanyu_full|background_fortress|loadHeroSpriteFrame|\.sprite\(|\.clippedSprite\(' assets/scripts
node scripts/cocos-sync-domain.js --check
node /Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/bin/tsc --noEmit --pretty false
nice -n 15 ./scripts/cocos-build.sh wechatgame
du -sh build/wechatgame build/wechatgame/assets/resources
```

预计 1–2 个开发日完成页面替换、资源清理与微信模拟器验收；包体目标为估算值，不作为未经构建验证的完成结论。本轮结束后再单独打磨“首次推关→招募增强→挂机回归→继续推关”的玩法闭环，暂不扩张新美术或副玩法。
