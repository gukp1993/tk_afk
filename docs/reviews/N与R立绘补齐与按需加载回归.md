# N 与 R 武将立绘补齐与按需加载回归

时间：2026-10-05。状态：已实施待微信真机验收。

## 交付范围

新增 N 品质 37 张与 R 品质 43 张，共 80 张原创透明底 3D Q 版立绘；文件名使用 `utils/heroes.js` 中的英雄 ID，放入 `assets/art-heroes/` 微信分包。所有图片为 600×800 PNG，每张配有唯一 Creator `.png.meta` UUID 与 sprite-frame 裁切信息。全 roster 共 120 张（N37/R43/SR24/SSR16）。

资源名单直接从 `HEROES` 数据读取，构建前检查每名英雄的 PNG 与 meta 文件，避免页面临时映射或复制规则数据。80 张新增 PNG 总体积以构建报告为准；单图体积不代表 GPU 纹理内存。

## 加载与显示

`ArtService` 不在启动时解码整包立绘；英雄包只预载 scenes，页面调用 `CocosUi.heroIcon` 时按 `<heroId>/spriteFrame` 逐张读取。该 key 与 Cocos Creator 实际分包路径一致；裸 hero ID 在构建产物中无法解析。滚动图鉴只加载当前视口卡片，滚动结束后加载新进入视口的卡片。离页销毁旧节点后释放已解码立绘；回调带页面节点和 generation 校验，避免旧页面迟到结果污染新页缓存。没图、加载失败与未就绪时继续显示原占位。

## 验证记录

- `node scripts/cocos-sync-domain.js --check`
- Creator 内置 TypeScript `tsc --noEmit --pretty false`
- `node test/smoke.js`
- `./scripts/cocos-build.sh web-mobile`，并用 headless 浏览器检查战役/图鉴的人物显示与滚动换图。
- `./scripts/cocos-build.sh wechatgame`，核对微信主包 4 MiB 与总包 30 MiB 上限。

本记录中的验证项只有在实际运行后才填入结果；Web 截图与构建不能代替微信真机分包冷加载、触摸及纹理内存验收。
