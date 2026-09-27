# 素材交付与切片说明 v1

交付方式：**透明 PNG 图集 + 每个元素的像素矩形**。图标已经从页面结构中独立出来，可以分别创建 SpriteFrame；没有输出33个重复存储的单图文件。关羽和城关分别为独立文件。本包在 docs 内，不会自动参与游戏构建。

## 1. 文件与用途

| 文件 | 实际尺寸 | 格式 | 内容 |
|---|---|---|---|
| [icons-common-v1.png](assets/icons-common-v1.png) | 1254×1254 | RGBA透明 | 16项：五导航、铜钱/元宝、生命/攻击/防御、左右箭头、实/空星、加号、关闭 |
| [badges-skills-v1.png](assets/badges-skills-v1.png) | 1774×887 | RGBA透明 | 8项：全部/魏/蜀/吴/群无字底章、关羽两技能、编队 |
| [components-v1.png](assets/components-v1.png) | 1182×1330 | RGBA透明 | 9项：N/R/SR/SSR卡框、主按钮、深色面板、剑/甲/玉军械图标 |
| [guanyu-full-v1.png](assets/guanyu-full-v1.png) | 1024×1536 | RGBA透明 | 完整关羽，列表与详情同一身份母版 |
| [background-fortress-v1.png](assets/background-fortress-v1.png) | 941×1672 | RGB不透明 | 无字无人城关背景，叠深墨遮罩后用于列表/详情 |

共5张PNG，35个命名Sprite，其中33个图标/组件。图集含真实alpha，不是画上去的棋盘格。透明边缘经过读取通道检查；源图仍需在正式目标尺寸、不同底色下做美术与双平台验收。精细金边缩小后可能需要进一步简化。

这些是以已选原型为参考、经内置ImageGen去底/清理/补绘的素材，不是从第三方游戏取图，也不是保证与原型逐像素完全相同的无损抠图。原画没有独立图层：人物衣摆、武器遮挡处、无字底板、卡框其他品质配色和城关空景需要重建。关羽手臂、衣纹和完整武器以本次母版为后续身份基准。

## 2. ID 一览

| 分组 | manifest中的ID |
|---|---|
| 导航 | `nav_home`、`nav_journey`、`nav_campaign`、`nav_heroes`、`nav_bag` |
| 资源/属性 | `currency_gold`、`currency_gem`、`stat_hp`、`stat_atk`、`stat_def` |
| 基础控制 | `chevron_left`、`chevron_right`、`star_on`、`star_off`、`plus`、`close` |
| 阵营底章 | `faction_all`、`faction_wei`、`faction_shu`、`faction_wu`、`faction_qun` |
| 技能/编队 | `skill_guanyu_ult`、`skill_guanyu_passive`、`formation` |
| 品质/控件 | `frame_n`、`frame_r`、`frame_sr`、`frame_ssr`、`button_primary`、`panel_dark` |
| 军械 | `armory_weapon`、`armory_armor`、`armory_jade` |
| 整图 | `hero_guanyu_full`、`background_fortress` |

军械三图只是“全军军械”入口的装饰摘要，不意味着把内核六部位删成三个。`currency_gem`在本项目是元宝图标的资源ID，不代表新钻石货币。`formation`是圆形编队徽章，需用在适合圆章的入口；宽按钮文字仍为Label。

## 3. 坐标契约

[assets-manifest.json](assets-manifest.json) 是坐标唯一来源，不能按图像视觉猜成严格等分网格：生成器的间距并非完全均匀。矩形在透明间隔内按alpha>8（0～255）的可见包围盒加4像素留白确定，排除生成图中近乎不可见的零散透明噪点；原PNG未改写。

```json
{
  "coordinateSystem": "top-left pixels",
  "rotated": false,
  "trimmed": false,
  "textures": {
    "icons-common-v1": {
      "file": "assets/icons-common-v1.png",
      "width": 1254,
      "height": 1254,
      "hasAlpha": true
    }
  },
  "sprites": {
    "示意ID": {
      "texture": "icons-common-v1",
      "rect": {"x": 0, "y": 0, "w": 100, "h": 100},
      "pivot": [0.5, 0.5],
      "slicing": "simple"
    }
  }
}
```

上段矩形仅说明字段；真实ID/坐标读取JSON，不复制示意数值。x/y从图片左上角起，w/h为源像素，不是750设计稿坐标。矩形已经包含少量透明留白；无旋转，也没有另行记录trim位移。`originalSize`取矩形w/h，居中offset为0。使用Cocos导入后的Texture2D创建SpriteFrame，不把系统绝对路径传给resources.load。

`textures.file`相对本交付目录，SHA256与实际像素信息可用来校验后续文件是否被替换。替换源图后必须重做矩形测量；只替换同名文件、不更新坐标会切到邻图。

## 4. 使用规格与状态

- 导航图显示约52～64设计单位；阵营底章约64～72，点击区88以上；属性图约32～40；星星约24～30；技能图约100～116。最终尺寸遵照[产品设计](01-product-design.md)，缩放只等比。
- 阵营底章中央叠中文Label。品质用对应边框加N/R/SR/SSR文字，色彩再按配置核验；不要只靠细边颜色让玩家区分品质。
- 选中/按下/禁用用Cocos颜色、描边、透明度、轻微缩放表达，不需要各复制一张图。选中背景不能把金属固有色全染白；按下建议0.97倍，禁用同时禁点击并有文字原因。
- `button_primary`、`panel_dark`和四品质框当前全部标记`slicing:simple`。它们可用于原型，但九宫格inset**没有经过Cocos拉伸验收**。在编辑器测量角饰范围、验收目标长宽后，再新增border字段；不能用默认四边16去拉坏云纹。
- 首版卡片可等比放大透明人物到Mask，固定脸部锚点。`faceAnchorNormalized`为本次关羽约[0.5,0.14]的定位起点，人工微调允许；它不是人脸检测结果。生产列表应另导出小尺寸头像，避免同时解码120张全身图。
- 数字、技能说明、姓名、品质、上阵、等级、星级、资源金额均不在图片中。截图中的展示数值不进规则配置。
- 缺其他人物时只显示其姓名/剪影占位；不能复制关羽并改名。当前交付不含其他八位武将的独立立绘。

## 5. 复核与接入顺序

1. 打开[交互预览与素材册](index.html)，在深色、浅色、棋盘背景切换检查每枚图。预览只读示例数据，不访问玩家存档。
2. 运行`python3 docs/hero-ui-handoff-v1/verify_assets.py`（需Pillow；本机已具备），检查尺寸、文件哈希、透明、矩形边界与重叠。脚本只读取PNG，不编辑图片。
3. 先将公共小图和关羽导入Cocos验证，确认一枚非对称箭头和刀锋方向、中心透明的卡框没有旧背景，再铺开。
4. 字体/中文Label、滚动、安全区、点击事件、实时数据由开发实现。细分接入方案见[开发文档](02-cocos-development.md)。
5. 接入后按15项产品验收及双平台设备验收执行。当前只能说明源文件/预览检查结果，不能宣称Cocos运行画面或微信、抖音真机已经通过。

生成原文：`assets/prompt-common-icons.txt`、`prompt-badges-skills.txt`、`prompt-components.txt`、`prompt-guanyu-cutout.txt`、`prompt-background.txt`。后续统一人物模板见[立绘提示词](04-character-prompts.md)。
