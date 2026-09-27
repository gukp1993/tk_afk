# 群英录与关羽详情 · Cocos 开发规格 v1

日期：2026-09-27。目标工程：仓库根目录 Cocos Creator 3.8.8。本文为实现交接规格，**不是已完成的运行实现**；本轮素材位于本目录 `assets/`，尚未导入 Cocos、绑定 SpriteFrame、验收设备性能。依据是本轮只读核对的工作区代码，包含其他执行者的未提交迁移工作；实施前重新核对，不覆盖这些变更。

## 1. 交付范围与工程边界

以已确认的墨绿漆木、铜金、绢纸风格重建两页：三列英雄列表与关羽详情。使用原生 Node、Sprite、Label、ScrollView 和可复用组件。整张原型只用于比对，不能做一张背景图叠透明热区充当成品。

- 根工程入口：`assets/scene/Main.scene` → `assets/scripts/CocosBootstrap.ts`。
- 页面入口：`assets/scripts/screens/HeroScreens.ts` 的 `heroes(ctx)`、`heroDetail(ctx)`。
- UI 基础：`assets/scripts/ui/CocosUi.ts`。现状以 Graphics 占位与 Label 为主；没有现成通用 Sprite 加载封装，接图需新增资源服务/组件。
- 导航协议：`assets/scripts/screens/ScreenContext.ts`，已有 `heroes`、`heroDetail`、`formation`、`armory`、`summon` 等 Page。
- 规则来源：`utils/store.js`、`utils/heroes.js`、`utils/config.js`、`utils/items.js`。`scripts/cocos-sync-domain.js` 生成 `assets/scripts/domain/*.ts`；除手写 `platform.ts` 外不手改生成镜像。
- 自动战斗：`CocosBootstrap` 持有唯一 `AutoBattleSession`，由 `update()` 驱动；英雄页不新建、重启、暂停或销毁战斗服务。
- 本次不增加个人升级、手动升星、个人穿戴、技能升级或新数值。不把原型里的等级、星数、战力、已拥有数量写入玩家存档。

## 2. 当前实现与需要收口的差异

| 当前代码事实 | 新界面实施要求 |
| --- | --- |
| 720 × 1280，`FIXED_WIDTH`，长屏通过 `verticalScale` 调整部分位置 | 延续逻辑基准，补安全区域与约束布局；原型 PNG 像素不是节点坐标 |
| `heroes()` 已用 `U.scroll('HeroGrid', ...)`，三列、按全部已拥有英雄一次创建节点 | 第一阶段可沿用以验证功能；整池及连续滚动实测不达目标时改为行复用，禁止默认同时加载全体高清立绘 |
| 筛选为 all/wei/shu/wu/qun，排序 power/level/rarity/star | 前端展示战力/品质/星级；共享等级下去掉无区分价值的等级排序，星级不写“品阶” |
| 顶部提示仍有“查看技能、升级与装备” | 改为“查看武将、技能与编队”，成长提示明确“主公等级全体共享”“重复同名武将自动升星” |
| 现有详情 `clsName` 自建枚举与 `config.CLASSES` 不完全一致 | 使用 `config.CLASSES[h.cls]?.name`；关羽是 `warrior`，展示“武将” |
| 详情先执行 `calcHero(id)` 再判断是否拥有 | 必须先判 `getHero(id)` 和 `getOwned(id)`；`calcHero()` 内部直接读取 `own.star`，无效 ID 不会安全返回 null |
| `show(page)` 销毁重建页面子节点 | 可分阶段接入，但资源回调要有页面代次校验；不要每帧调用 `show()` 刷属性 |
| `CocosUi` 静态 Map 只按滚动区名字记 offset | 列表保留筛选、排序、offset/锚点；详情按 heroId 独立或切人归顶，避免共用 `DetailScroll` 串位置 |
| 现详情包括同名卡保护/兑换、自选券等现有入口 | 收到详情的“更多”折叠区；主视觉区只保留两技能、共享军械与调整编队，不删除已经存在的能力 |

收藏计数使用“全部已拥有数量 / `heroData.HEROES.length`”；阵营筛选另显示本次命中数量，不用过滤后的数量替代全池收藏进度。初版只显示已拥有武将；未拥有图鉴若以后增加，需独立展示态，不调用 `calcHero()` 伪造养成。

## 3. 数据适配层：准确使用现有 API

建议新增手写 `assets/scripts/presenters/HeroPresenter.ts`（路径为建议，当前不存在）。它把 domain 输出转为只读 ViewModel，视图不直接写 `getState()` 返回的对象。

| 实际来源 | 现状返回/字段 | UI 用途与注意 |
| --- | --- | --- |
| `heroData.HEROES` / `getHero(id)` | 定义数组 / 定义或 undefined；含 id/name/title/faction/cls/rarity/ult/passive | 静态身份、总池数、技能原文；未知 ID 先拦截 |
| `store.getOwned(id)` | roster 项或 undefined；id/star/cards/lockedCards，仍有兼容 equip 字段 | 是否拥有、星级与额外同名卡；equip 不是新版独立穿戴入口 |
| `store.allRoster()` | 对每个 roster ID 执行 `calcHero` 得到数组 | 当前合法存档下的列表数据；异常条目需诊断/兜底，不静默删档 |
| `store.calcHero(id)` | 对象：id/name/title/faction/cls/rarity/level/star/cards/stats/power/ult/passiveDef/armory 等 | 拥有且定义存在后才调用；属性和战力直接用结果，不重算倍率 |
| `store.playerLevel()` | number | 列表共享主公等级、详情等级 |
| `store.playerXpNeeded(level)` | number；满级为 0 | 仅成长说明需要，0 分母显示“等级已达上限” |
| `store.getState()` | 当前可变状态对象；player/res/formation/roster/vouchers 等 | 即取即读，不缓存引用作为 UI 不变快照；ViewModel 复制所需原始值 |
| `config.FACTIONS` / `CLASSES` / `RARITIES` | 配置索引；稀有度数字 1–4 | 阵营职业名称、品质名、`maxStar`；不使用原型固定五颗星代表所有品质 |
| `store.getArmoryBonuses()` | hp/atk/def/heal/startShield/startEnergy/directDR 等 | 全军军械说明；属性已被 calcHero 合入，禁止二次加算 |
| `fmt.fmtNum(value)` | 格式化字符串 | 资源、属性、战力紧凑显示；详情长按/说明可提供完整整数 |
| `store.firstWinChoice()` | 含 available | 列表首胜奖励入口状态；选将交给现有领取流程 |
| `store.claimFirstWinChoice(id)` | `{ok, ...}` / `{ok:false,msg}` | 奖励动作走原 API，成功后刷新；不能因打开界面重复领奖 |
| `store.applyFormation(ids)` | 保存事务结果 `{ok, formation}` / `{ok:false,msg}` | 编队确认沿用现成事务；英雄详情只导航到编队 |
| `store.setFormationSlot(slot,id)` | 无返回值，直接修改内存 | 不是可直接当成 `{ok}` 的新事务接口；新详情无需直接调用 |

生成镜像带 `// @ts-nocheck`，现有页面大量使用 `any`；上表是运行形状，不应声称已有完整严格类型。新建 ViewModel 建议定义：

```ts
type FactionKey = 'wei' | 'shu' | 'wu' | 'qun';
type HeroSort = 'power' | 'rarity' | 'star';
interface HeroCardVM {
  id: string;
  name: string;
  faction: FactionKey;
  rarity: number;
  rarityLabel: string;
  star: number;
  maxStar: number;
  power: number;
  inFormation: boolean;
  portraitKey: string;
}
interface HeroDetailVM extends HeroCardVM {
  title: string;
  classLabel: string;
  sharedLevel: number;
  hp: number;
  atk: number;
  def: number;
  skills: { key: 'ult' | 'passive'; name: string; desc: string }[];
}
```

这只是待实现的 UI 类型，不是 domain 已导出的类型。`portraitKey` 通过资产映射查找，缺图用阵营底色 + 姓名字样，不把缺图当“未拥有”。排序使用明确比较函数：主键降序，再战力降序，再稳定 ID 排序；不要用 `rarity * 100000 + power` 这类会被大数值越界打乱品质优先级的拼接权重。

关羽验收样本：`id='guanyu'`、`faction='shu'`、`cls='warrior'`、`rarity=4`。必杀“青龙偃月斩”、被动“武圣威严”，技能详情直接读取 `ult.desc` / `passiveDef.desc`。原型三颗星、Lv.40、生命/攻击/防御示例值均不参与运行规则。

## 4. 节点与 Prefab 划分

以下为目标结构，不要求一次替换所有迁移页。现有 `HeroScreens` 可先充当挂载入口，生命周期由 Bootstrap 统一持有。

```text
GameContent
├─ HeroRosterRoot
│  ├─ Background              Sprite：静态背景，不含文字
│  ├─ SafeHeader
│  │  ├─ ResourceBar          资源图标 + Label
│  │  ├─ TitleRow             群英录 Label + 编队 Button
│  │  ├─ SharedLevelRow       共享等级 / 收藏计数
│  │  ├─ StarterRewardEntry   仅可领取时显示
│  │  ├─ FactionFilter        5 个 FactionChip
│  │  └─ SortRow              3 个排序按钮
│  ├─ RosterScroll            ScrollView / Mask
│  │  └─ Content              三列 HeroCard（可升级行复用）
│  ├─ EmptyState              文字 + 召唤入口
│  ├─ SharedGrowthHint        自动升星说明
│  └─ BottomNav               沿用全局五页导航，勿重复挂载
└─ HeroDetailRoot
   ├─ Background
   ├─ SafeHeader              返回 Button / 标题 / 资源
   ├─ DetailScroll            ScrollView / Mask
   │  └─ Content
   │     ├─ PortraitStage     场景底 + 透明立绘 + 角色身份 Label
   │     ├─ SharedStatus      共享等级 / 已上阵
   │     ├─ StatStrip         生命 / 攻击 / 防御
   │     ├─ Skills            2 个 SkillTile
   │     ├─ SharedArmoryEntry 图标 + 共享军械说明 / 箭头
   │     ├─ GrowthInfo        自动升星 / 更多既有功能
   │     └─ ReturnToRoster    仅列表来源显示，内容末行独立返回热区
   └─ SafeFooter              仅调整编队 Button，保持固定可见

OverlayRoot（同级、最上层）
└─ SkillDescriptionModal      遮罩 / 标题 / 正文 ScrollView / 关闭
```

可复用 Prefab：`HeroCard`、`FactionChip`、`RarityStars`、`SkillTile`、`ResourcePill`、`FramedButton`。HeroCard 内分 Background / PortraitMask / Portrait / Frame / FactionMedallion / RarityLabel / NameLabel / StarRow / FormationTag / HitTarget，便于独立换图与命中检测。不要把卡名、稀有度、星级和“出战”字样烘焙进图。

布局按有效安全区计算：顶部资源、筛选和底部导航固定；中间列表吸收高度变化。详情头尾固定，中间内容允许滚动，小屏优先减装饰而非缩小文字。默认点击目标不小于 44 CSS 等效像素：720 逻辑宽在 360 像素屏上约需 88 逻辑单位，按实际缩放核验，不能把原型图里的 44 像素直接当 44 逻辑单位。资源无点击行为时不必伪装按钮。

## 5. 素材导入、alpha 与九宫格

文档包 `docs/hero-ui-handoff-v1/assets/` 是设计交付源，**不会自动参与 Cocos 构建**。落地建议将验收后的源文件导入 `assets/resources/hero-ui/`，例如 `common/`、`factions/`、`skills/`、`heroes/guanyu/`。后续批量英雄优先拆 Asset Bundle，不全部堆入 resources。此处为建议结构，实际文件 ID、尺寸、裁切矩形以本交付素材清单为准；不得把建议路径误认为现有可加载 URL。

### 5.1 本次素材清单的实际契约

已核对 [assets-manifest.json](assets-manifest.json)：`version: 1`，5 张纹理，35 项 sprite（33 项图标/组件 + 关羽立绘 + 城关背景）。它交付的是 **PNG + 裁切坐标 JSON**，不是已导入 Cocos 的 SpriteAtlas 或 Prefab。清单状态明确为 `design-source-not-imported-to-cocos`。

| 字段 | 本次实际约定 | 接入要求 |
| --- | --- | --- |
| `coordinateSystem` | `"top-left pixels"` | x/y 是源 PNG 左上原点像素，不是 Cocos 节点坐标 |
| `rotated` / `trimmed` | 全局均为 `false` | 本交付无需还原旋转或图集 trim；后续重新打包必须跟随新元数据 |
| `textures` | 以 texture ID 为键的对象 | 每项含 `file,width,height,hasAlpha,bytes,sha256`；透明图另有 `transparentPixelRatio` |
| `textures[id].file` | 相对本清单目录的 `assets/*.png` | 不是 resources.load 的现成 URL；导入后生成实际资源路径/UUID 映射 |
| `sprites` | 以 sprite ID 为键的对象 | 用稳定 ID 绑定 UI，不依赖对象遍历顺序 |
| `sprites[id].texture` | textures 中的 ID | 校验存在，再使用相应图源 |
| `sprites[id].rect` | `{x,y,w,h}` | 校验非负、非零且不越界；w/h 映射裁切宽高 |
| `sprites[id].pivot` | 全部为 `[0.5,0.5]` | 是约定的中心锚点；节点 UITransform 锚点按布局绑定，不是纹理裁切偏移 |
| `sprites[id].slicing` | 全部为 `"simple"` | 当前不含已经验收的九宫格信息；所有 frame、button、panel 也一样 |

| 纹理 ID | 源尺寸 | Alpha | 内容 |
| --- | --- | --- | --- |
| `icons-common-v1` | 1254 × 1254 | 有 | 导航、资源、属性、箭头、星与通用操作，共 16 项 |
| `badges-skills-v1` | 1774 × 887 | 有 | 五阵营、关羽两技能、编队，共 8 项 |
| `components-v1` | 1182 × 1330 | 有 | 四品质框、主按钮、底板、三军械图标，共 9 项 |
| `guanyu-full-v1` | 1024 × 1536 | 有 | `hero_guanyu_full`，rect 为完整图像 |
| `background-fortress-v1` | 941 × 1672 | 无 | `background_fortress`，rect 为完整图像 |

`heroPortraits.guanyu.detailSprite` 指向 `hero_guanyu_full`，`faceAnchorNormalized` 为 `[0.5,0.14]`，用于统一脸部构图位置；不要当成所有武将永远相同的脸部坐标。`listViewport` 明确当前原型从同一立绘缩放裁切，**生产版小尺寸列表衍生图尚需制作**，不能声称已经交付独立列表缩略纹理。

字段完整性及矩形检查不等于小尺寸视觉或引擎导入验收。尤其 `frame_n/r/sr/ssr`、`button_primary`、`panel_dark` 当前都只按 SIMPLE 使用；若按目标比例拉伸出现角饰变形，应按下节拆件或另制可拉伸资源，不自动填入猜测的九宫格 inset。

### 5.2 导入与视觉检查

1. 独立透明 PNG 优先按 SpriteFrame 导入，确认 alpha 真实存在；棋盘格背景不能作为“透明已成功”的证据。黑底、浅底和实色绿底各看一遍，检查刀锋、须发、金边是否有旧背景光晕、毛边或半透明缺口。
2. 图集坐标清单只是源图的像素切片描述，不等于 Cocos `SpriteAtlas` 文件。需要导入器/编辑器拆 SpriteFrame 或另行打包图集；接入前验证原点、x/y/w/h、源图宽高、是否旋转、trim 信息。
3. 本项目 3.8.8 引擎本机源码确认 `SpriteFrame.reset` 支持 texture、rect、originalSize、offset、borderTop/Bottom/Left/Right；直接构造时使用 `Rect`/`Size`/`Vec2`。禁止把 UI 节点中心坐标误传作图片 rect。
4. 如果清单是左上原点且未旋转、未 trim 的像素格，逐项映射并以至少一枚非对称图标核验方向；若改用打包器输出，其旋转/trim/offset 必须跟随该打包器格式，不套用旧坐标。
5. 自动图集可用于同屏小图；保留足够 padding/extrude，逐尺寸检查串色。大立绘、背景、九宫格边框分组，不把一张高清关羽立绘塞进公共图标图集导致任何页面都常驻大纹理。
6. 卡框/按钮底使用 `Sprite.Type.SLICED` 的候选素材必须有完整四角、连续边缘、可拉伸的低细节中央区域。九宫格 inset 需在编辑器按像素测量并缩放验证；不要从整页截图猜四个固定值。角饰复杂时拆角饰 + 边线 + 底板，比硬拉伸整块更稳。
7. 人物用 `Sprite.Type.SIMPLE`，等比缩放；卡面裁切依靠 Mask 和固定脸部锚点。列表用独立低分辨率半身裁切，详情用完整透明立绘，共享角色定妆但不强行共享一张大纹理。
8. 图标只含形状与底牌；魏/蜀/吴/群、数值、技能名、按钮文字都由 Label 输出。若拆图含旧字，先用无字替代图，不盖一层新字掩盖残留。

当前 `CocosUi.text()` 使用系统 `Kaiti SC` 与 SHRINK；这不保证双平台手机有同名字体。标题可配经许可的字体文件或专用标题图，正文使用稳定中文字体/回退方案。动态技能正文要允许换行和滚动，避免 SHRINK 把长技能压到无法阅读；字体打包或子集化要核对 120 将名、技能、单位及动态字符完整性。正文仍由 Label 管理，不能随 UI 原图烘焙。

## 6. 交互、滚动与状态刷新

| 触发 | 行为 | 保留/刷新规则 |
| --- | --- | --- |
| 全局“英雄”导航 | `ctx.go('heroes')` | 已访问时恢复页面内筛选/排序与滚动；初次默认全部 + 战力 |
| 点武将卡 | 写 `ctx.selectedHeroId=id` 后 `ctx.go('heroDetail')` | 保存列表锚点；打开前再次验证是否存在/拥有 |
| 详情返回 | `ctx.back('heroes')` | 从召唤结果进入应回召唤结果；“返回群英录”只在列表来源显示于滚动内容末行，可直接 `go('heroes')` |
| 选择阵营/排序 | 仅修改页面状态并刷新列表 | 主动筛选/排序归顶；详情返回不归顶 |
| 点技能 | 打开模态技能正文 | 保留详情滚动，阻断底层点击，关闭回原位，不新增技能升级 |
| 点全军军械 | `ctx.go('armory')` | 返回详情后重读 calcHero 和共享军械加成 |
| 点调整编队 | `ctx.go('formation')` | 现入口可直接使用；定位到本英雄属于可选后续增强，不假定已有此参数 |
| 首胜奖励、自选券/同名卡操作 | 调现有 domain 动作与确认 | 依据 `{ok,msg}` 反馈并刷新；高品质兑换沿用二次确认 |
| 自动战斗结算、回前台 | Bootstrap/服务统一通知数据变化 | 重读等级/战力/资源；不改当前筛选，不因属性变化把用户滚动位置重置 |

新建 `HeroRosterViewState` 可存 faction/sort/topHeroId/offsetInRow/scrollOffset；它属于临时 UI 状态，不写旧存档 schema。返回恢复：先计算过滤后的数据和 contentH，再按 ID 找锚点，最后将 offset 限制在 `0..maxOffset`；锚点被移除则退回附近有效行。单存绝对 offset 会在卡片高度、奖励条、横竖屏/安全区变化后偏位。

第一阶段仍用现有 `CocosUi.scroll` 时保证 `HeroGrid` 命名唯一，筛选才调用 `CocosUi.resetScroll('HeroGrid')`。详情为 `HeroDetail:<id>` 或显式重置；不能保留上一人的技能位置却展示另一人的立绘。

当前 domain 没有公开 store 订阅总线。实施时在 Bootstrap 的成功业务动作/战斗结算/回前台处发轻量“数据版本变化”通知，或在页面进入与已知动作成功后刷新；这是需新增的 UI 通知层，不是假定存在 `store.subscribe()`。若暂时以定时快照兜底，限制频率，仅比较必要字段；不要每帧 `calcHero` 全池并销毁全屏。

## 7. 异步加载与资源生命周期

建议新增 `HeroAssetService`：统一加载映射、缓存、错误回退和引用计数；卡片不各自向平台发下载请求。平台 I/O 留在适配层，不在页面直接调用 wx/tt。

- 页面创建递增 `viewGeneration`；卡片绑定递增 `bindGeneration` 并记录 heroId。资源返回时同时检查页面尚有效、节点尚有效、两个代次和 heroId 一致才赋值，避免快速切人后赵云图片覆盖关羽。
- 加载开始即展示占位，成功只替换对应 SpriteFrame，不重建整页；失败保留点击、姓名和属性，提供有限重试，不能进入无限请求循环。
- 缓存使用 Asset 引用管理（例如统一持有与释放 `addRef/decRef`）；共享图标的释放由服务管理，不由任一卡片随意 `releaseAsset`。不要同时自动引用释放和手写无条件释放同一资源。
- 退页取消定时器/订阅/事件，失效尚未完成的回调；onDestroy 不能只 destroy 节点却遗留闭包。节点池每次复用解绑旧监听、清空旧 SpriteFrame 和 selected/出战状态，防重复点击回调。
- 详情可预加载当前英雄，下一人仅在确有切换需求时低优先级预取；本版无需加载全体高清图。应用退后台沿用 Bootstrap 生命周期，UI 资源服务不得另建自动战斗计时器。

## 8. 性能与小程序资源安排

先做 9 张可见卡 + 上下各一行的缓存目标，约 15 个卡片实例；实际数量由 viewport 与卡高计算，不硬编码“永远 15”。虚拟列表 content 高度保持全部行长度，节点只绑定可视行。第一阶段保留全列表节点也必须限定图片预加载窗口，并用真实全池数量测试。虚拟化本身不应改变筛选、排序、命中区或阅读顺序。

纹理常驻成本按解码后像素估算，而非 PNG 文件大小：RGBA8 约 `w × h × 4` 字节，不含附加副本、mipmap 和引擎开销。示例为**预算估算**：

| 示例纹理 | 单张解码估算 | 意义 |
| --- | --- | --- |
| 256 × 384 列表头像 | 0.375 MiB | 15 张约 5.625 MiB；120 张约 45 MiB |
| 768 × 1024 详情立绘 | 3 MiB | 同时持有 120 张约 360 MiB，应按需加载 |
| 1024 × 1024 公共图标图集 | 4 MiB | 尽量让同屏小图共用；图集尺寸不是越大越好 |

这些不是当前交付素材尺寸或实测内存。生产输出需按实际裁切面积与画质对比定规格。UI 不需 mipmap 时避免无谓的额外驻留；纹理压缩格式、alpha 和滤波选择在双平台真机验证，不能只凭 Web 预览确认。

主包保留首屏公共 UI 和兜底图；英雄半身/高清立绘按功能或英雄分组进入 Creator Asset Bundle，依到达页面加载。不要自建第二套平台下载缓存替代引擎机制。远程 Bundle/CDN 是后续包体超预算时的方案，配置域名、缓存版本、失败回退后再启用，本交付不擅自部署远程服务。平台上传限额以实施时开发者工具与官方规则核对，本文不沿用历史聊天里的固定 MB 数作为保证。

## 9. 异常边界与验收用例

| 场景 | 预期 |
| --- | --- |
| 关羽合法拥有 | 显示真实等级/星级/属性/技能；蜀阵营、SSR、武将职业，姓名不来自图片 |
| 无效 selectedHeroId / 定义缺失 / 未拥有 | 在 calcHero 前拦截，显示简短提示并安全返回；不清存档，不伪造状态 |
| 阵营无英雄 | 有空状态与前往召唤，不出现空白或可点假卡 |
| 0 星与满星 | 使用对应品质 maxStar，N/R/SR/SSR 不混用上限；满星文案说明多余同名卡现有处理入口 |
| 主公等级变化 / 军械增强 | 卡片战力和详情属性同步读取内核；全体共享等级一致，不重复加军械加成 |
| 滑动时掠过卡片 | 不误打开详情，快速滑动不闪错英雄、重复响应 |
| 连续详情进退 30 次 | 筛选/排序/锚点保持；监听、请求、纹理驻留不持续增长 |
| 弱网/缺图/透明图加载失败 | 字与功能可用，有稳定占位，不白屏，不自动消费任何资源 |
| 自动战斗中浏览英雄/军械 | 全局只有一个会话，继续结算；页面只更新显示，不重复开启/结算 |
| 操作保存失败 | 使用 domain 返回的失败文案；不显示已成功、不给虚假升星动画 |
| 刘备/张飞/关羽多种详情来源 | 从列表、召唤结果、编队来源正确返回，不陷入重复历史栈 |
| 320/360/390/430 等显示宽度与长屏/刘海 | 文本、按钮和安全区无重叠；详情可滚到全文与主操作；不把所有内容缩得很小 |

模态层需要吞掉底层触摸和滚动。资源图标缩到真实尺寸后仍可辨认，阵营不能仅凭颜色区分，应保留文字。通用返回按钮与底部动作至少有触摸反馈；加载动画不得遮住返回或吞掉退出操作。

## 10. 分阶段实施与验证命令

| 阶段 | 可审阅结果 | 完成条件 |
| --- | --- | --- |
| A 资源导入 | 关羽立绘、卡图、图标、框/底板导入映射 | alpha/裁切/九宫格/小尺寸可读性审查，无文字烘焙 |
| B 只读两页 | 关羽列表与详情原生节点、真实只读数据 | 页面布局、缺图、空列表、各品质星级、返回恢复通过 |
| C 交互接入 | 筛选/排序/技能/军械/编队/既有更多功能 | 接口与动作来源正确，旧流程未丢失，无个人升级/穿戴误导 |
| D 生命周期与优化 | 数据刷新、加载隔离、列表复用或证实无需复用 | 全池与快速导航/后台回流可用，内存趋势稳定 |
| E 发布前对照 | Web、微信、抖音测试包与截图 | 两平台模拟器与真机逐页签核，未通过项目明确列待办 |

文档和设计素材本轮无需声称跑过游戏回归。实际运行代码实施时，先检查工作区归属并执行：

```sh
node scripts/cocos-sync-domain.js --check
node /Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/bin/tsc --noEmit --pretty false
node test/smoke.js
node test/static-check.js
node test/formation.js
node test/store-transaction.js
node test/cross-page-auto.js
./scripts/cocos-build.sh web-mobile
./scripts/cocos-build.sh wechatgame
./scripts/cocos-build.sh bytedance-mini-game
```

`cross-page-auto.js` 等现有测试覆盖规则/旧实现边界，不能当作新 Cocos Prefab 已验收的证据；新增的 presenter 排序/空值处理与异步竞态需针对行为补测试，Cocos 导航/滚动/素材必须在运行界面验证。若同时修改 `utils/`，先运行 `node scripts/cocos-sync-domain.js` 生成镜像，并 `node build.js` 同步旧双平台，再跑相应逻辑回归；不手工修生成目录来让检查过关。

测试存档使用独立内存桩或隔离的开发测试环境，禁止清除/读写用户真机存档来制造样本。Web 构建成功仅说明构建链通过，不等于 alpha、按钮命中、共享规则或双平台设备验收通过。

## 11. 可追溯依据

- [根工程与构建配置](../../package.json)、[构建脚本](../../scripts/cocos-build.sh)、[规则同步脚本](../../scripts/cocos-sync-domain.js)。
- [Bootstrap 导航和生命周期](../../assets/scripts/CocosBootstrap.ts)、[ScreenContext 协议](../../assets/scripts/screens/ScreenContext.ts)、[英雄页面现状](../../assets/scripts/screens/HeroScreens.ts)。
- [UI 节点和滚动实现](../../assets/scripts/ui/CocosUi.ts)、[自动战斗服务](../../assets/scripts/services/AutoBattleSession.ts)。
- [角色定义](../../utils/heroes.js)、[存档与派生属性 API](../../utils/store.js)、[阵营/职业/品质配置](../../utils/config.js)。
- [上轮视觉原型及边界](../prototypes/heroes-v1/README.md)。

SpriteFrame 参数与资源生命周期建议同时对照本机 Creator 3.8.8 随附引擎源码核对；素材清单的实际 rect、inset、打包 UUID 与设备表现仍需在阶段 A/E 逐项验证，本文不伪造已导入结果。
