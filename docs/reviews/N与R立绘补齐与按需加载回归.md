# N 与 R 武将立绘补齐与按需加载回归

时间：2026-10-05。状态：已实施待微信真机验收。

## 交付

新增 N 品质 37 张与 R 品质 43 张，共 80 张原创透明底 3D Q 版立绘；以 `utils/heroes.js` 的英雄 ID 命名，放入 `assets/art-heroes/` 微信分包。全 roster 120 名（N37/R43/SR24/SSR16）均有对应立绘。所有新图为 600×800 PNG，配有唯一 Creator `.png.meta` UUID 与匹配的 sprite-frame 裁切数据；80 张 PNG 共 6,466,971 字节。

并行生成后终审发现 11 对同文件重复，已逐名替换并全量复核：120 张 PNG SHA-256 均唯一，120 个 meta UUID 均唯一。关平也重新生成了明确的成年男性蜀将形象。预览见[立绘总览](../prototypes/精品化UI/N与R立绘总览.jpg)、[图鉴实拍](../prototypes/精品化UI/N与R立绘图鉴实拍.png)，完整提示词与名单见[提示词文件](../prototypes/精品化UI/N与R立绘生成提示词.md)。

## 接入

`ArtService` 启动只预载场景，不整包解码立绘；`CocosUi.heroIcon` 按 `<heroId>/spriteFrame` 从 `art-heroes` 分包加载。构建产物里的 paths 按 UUID 索引，裸 ID 无法加载。图鉴卡片由 `loadVisiblePortraits` 按视口发起请求；切页销毁节点后释放已解码立绘，页面节点有效性与 generation 检查过滤迟到回调；加载失败仍显示原占位。

## 验证

- `node scripts/cocos-sync-domain.js --check`：通过；Creator TypeScript `tsc --noEmit --pretty false`：通过。
- `node test/smoke.js`：619 项通过，0 失败。
- `node test/simulation.js`：200/200 种子在第 30 天通关 120 关；通关日 P50 第 14 天、六槽 5★ P50 第 27 天、满星 SSR 均值 11.15/16，保持现有 ≤12 红线。立绘改动不影响规则。
- `./scripts/cocos-build.sh web-mobile` 与 `./scripts/cocos-build.sh wechatgame`：构建成功。无头 Chrome 720×1280 打开英雄页，4 个当前可见头像 PNG 请求返回 HTTP 200；`pageerror` 0，失败请求 0。截图保存在上述实拍文件。
- 最终微信包：主包 3,738,682 字节；art-heroes 等分包合计 11,267,809 字节；总计 15,006,491 字节，均低于主包 4 MiB / 总包 30 MiB 限制。

Web 实拍与构建不代表微信真机验收。设备冷启动、不同页滑动换图、峰值纹理内存与低端机帧率仍待真机核验。
