# 武将立绘统一提示词与出图规范 v1

这套提示词服务于本次选定的三国群英录，不使用第三方游戏的角色、图标或原画。使用内置 ImageGen；本轮未使用 CLI/API。提示词能约束风格，但不能保证每次生成逐像素一致。真正的稳定性来自同一参考图、固定画风段、固定构图、角色定妆和逐张验收。

## 1. 每次固定附上的参考

- **画风/材质参考**：[已选关羽详情](../prototypes/heroes-v1/hero-detail-guanyu-v1.png)。只学习绘画语言、金属处理、色彩层次；生成其他人时不能复制关羽的脸、胡须、绿袍。
- **关羽身份参考**：[透明关羽母版](assets/guanyu-full-v1.png)。仅生成关羽变体、头像、动画关键帧时使用。其他武将确认首张后，以自己的定妆图替换身份参考。
- **场景参考**：[城关底图](assets/background-fortress-v1.png)。只在生成背景时附上；生成透明人物时无需附场景，避免多出山水与光晕。

同一轮只更换人物变量，不同时改光线、比例、笔触和镜头。先以关羽、赵云、张飞三种体态验证共同风格，确认后再批量铺开；不要直接生成120张再统一返工。

## 2. 固定美术段（每次原样复制）

```text
Use case: stylized-concept / original Three Kingdoms character illustration.
Create one production-ready hero illustration for an original Chinese idle card game.
Use Reference A ONLY for the painting style, palette discipline and material rendering.
Semi-realistic heroic anatomy, hand-painted fantasy historical illustration, confident
ink-edged silhouettes, angular planes of painted light, subtle rice-paper-like brush
texture INSIDE the figure. Detailed face and upper armor; simplify subordinate folds.
Weathered bronze and muted antique gold, deep lacquer shadows, restrained silk sheen,
matte cloth, readable broad color masses. No photographic skin, no plastic 3D rendering.
Camera slightly below eye level, three-quarter standing pose, full figure with full weapon.
One soft warm key light from upper left; cool muted green reflected fill; clear face.
Eyes and facial features are the highest detail focal point; no blown-out metal highlights.
Real human proportions about 7.5 heads tall, grounded joints and hands, dignified presence.
Tall 2:3 composition, face centered near x=0.5 and y=0.16, entire silhouette and weapon
inside canvas with at least 6% margin. Make the head readable in a three-column mobile card.
Genuine transparent alpha outside the character. No environment, floor, pedestal, fog,
colored halo, cast shadow, UI, frame, badge, stars, lettering, watermark or logo.
Do not borrow any existing game's character design. Original Three Kingdoms interpretation.
```

## 3. 人物变量模板（接在固定段之后）

```text
Hero identity: {姓名，历史称谓；内部ID不画到图里}
Age and build: {年龄感、身高体态、肩颈比例}
Face: {脸型、眉眼、肤色、胡须；与已有角色区别}
Expression: {一种明确神态}
Hair / headwear: {发型、冠巾及辨识轮廓}
Costume: {主服装，领口，肩甲，腰带，衣摆；保持时代幻想的一致尺度}
Palette: {主色60%，辅色30%，点缀10%；不是全图蒙色}
Weapon / prop: {只给一种主要武器或道具，形制和握持}
Pose: {稳定重心、身体朝向、手的动作、披风风向}
Signature motifs: {最多2种纹样，不堆满全部表面}
Preserve from Reference B: {已有定妆时：脸型、发饰、甲胄与武器轮廓；首次则无}
Avoid for this hero: {其他角色的辨识特征、容易误生的物件}
```

## 4. 关羽完整人物段

与第2节固定段一起复制，并附 A=详情样稿、B=透明关羽母版：

```text
Hero identity: Guan Yu, the Martial Saint, original Three Kingdoms hero.
Age and build: mature man around 40, very tall, broad shoulders, powerful but proportionate.
Face: elongated angular face, warm ruddy complexion, long narrow eyes, heavy arched brows,
long flowing black beard and moustache. Keep the identity of Reference B.
Expression: stern, composed, unwavering; no shout or exaggerated grin.
Hair / headwear: dark emerald wrapped headcloth with subdued antique-gold band,
cloth tails flowing behind the head, long dark hair.
Costume: layered dark bronze lamellar armor, sculpted dragon shoulder plate, weathered
antique gold edges, forest-green robe and cape, dark leather belt, muted red waist cords.
Palette: forest and emerald green 60%, dark bronze/black 30%, antique gold and muted red 10%.
Weapon / prop: one long guandao, broad silver crescent blade, ornate bronze dragon socket,
dark shaft; correct hand grip; entire weapon visible.
Pose: three-quarter turn toward viewer's right, stable feet, forward hand holding shaft,
blade across the lower foreground, robe drifting right; face and beard unobstructed.
Signature motifs: dragon relief and restrained cloud scrollwork.
Preserve from Reference B: face, headcloth, beard, shoulder armor, robe color, blade silhouette.
Avoid: helmet instead of headcloth, short beard, second weapon, extra hands, neon green magic.
```

本次母版是从页面参考分离人物并补绘被遮挡衣摆/靴子/武器得到，不是原图无损逐像素裁切；它确定后，应作为后续关羽身份锚点。

## 5. 后续武将人物段示例

统一加第2节固定段；首次生成时仅附 A（画风），明确不复制关羽身份。以下是美术方向，不修改游戏配置的职业、阵营、技能或品质。

| 武将 | 年龄/脸型与轮廓 | 服装/配色 | 武器与姿态 | 禁止串用 |
|---|---|---|---|---|
| 赵云 | 25～30感，清俊长脸，利落眉眼，无胡须，银冠束黑发，修长有力 | 银灰甲60%、月白与低饱和蓝30%、暗金10%；云纹 | 长枪，三分之二侧身，枪身斜向上但留安全边；沉静警觉 | 关羽长髯绿巾、夸张肌肉、现代亮银机甲 |
| 张飞 | 35～40感，方脸、浓眉、圆眼、短硬络腮胡，颈肩厚实 | 黑铁与皮革60%、暗红30%、旧铜10%；兽纹 | 蛇形长矛，双脚稳站，身体微前倾；豪烈但不鬼怪化 | 关羽细长黑髯、赵云清瘦脸、裸露现代健美造型 |
| 诸葛亮 | 35～40感，清瘦长脸、细长眉眼、整齐短须，文士冠 | 青灰与象牙白60%、深蓝30%、旧金10%；云纹 | 单把羽扇，直立微侧身，袖袍自然垂落；从容 | 巨型战甲、魔法法杖、关羽长刀、过量光效 |
| 貂蝉 | 明确成年女性约25岁，鹅蛋脸、自然眉眼，优雅而坚毅 | 烟紫与淡绢白60%、深紫30%、旧金10%；花枝 | 汉风交领长衣、完整肩胸遮蔽，纤细发簪，丝带作陪衬 | 现代礼服、暴露铠甲、幼态、夸张身材、日式服饰 |

例如赵云变量段可以直接写：

```text
Hero identity: Zhao Yun, original Three Kingdoms spear general.
Age and build: adult man about 28, tall lean athletic build, elegant strong posture.
Face: narrow oval face, clear sharp eyes, straight brows, clean-shaven, composed resolve.
Hair / headwear: long black hair tied high with a restrained silver crown.
Costume: layered silver-grey lamellar armor over ivory cloth and muted blue cape;
subtle cloud engravings, dark leather waist belt, no modern mechanical shapes.
Palette: muted silver grey 60%, ivory and blue 30%, antique gold accents 10%.
Weapon: one long spear with a clean leaf-shaped silver head and restrained tassel.
Pose: three-quarter standing, stable weight, spear diagonal behind shoulder without
crossing face; entire spear and cape inside the image margin.
Reference A is style only. Give Zhao Yun a distinct identity, not Guan Yu's face.
Avoid: beard, green headwrap, guandao, bulky bodybuilder anatomy, polished 3D metal.
```

## 6. 列表半身图：从同一身份派生

开发阶段优先由同一张已批准母版做受控裁切，避免独立重画导致换脸。母版保留高分辨率；列表生产目标可先试256×384，详情按768×1024或实测档位输出，最终以手机清晰度与包体测试选择。透明母版实际尺寸见清单；上述尺寸不是内置工具一定返回的尺寸。

若必须补构图，用同一人物母版作为编辑目标：

```text
Use case: identity-preserve. Reference B is the APPROVED character master.
Create a bust/waist-up derivative for a 4:5 portrait card. Preserve exactly the same face,
hair, headwear, beard, armor design, colors, lighting and paint style. Move/crop the camera
only; do not redesign the person. Head near top center with 8% top clearance, shoulders
inside frame, leave bottom 20% visually quiet for a runtime name label. Real transparent
background. No border, typography, faction badge, stars, scenery or additional props.
```

卡片上加阵营、品质、姓名、星级、上阵条都由 UI 做。不要向生成器要求“顺便加上 SSR、关羽、三颗星”。

## 7. 技能与后续图标的统一提示词

```text
Use case: stylized-concept. One circular skill medallion for an original Three Kingdoms
game, matching the supplied approved UI. Weathered bronze thin rim, hand-painted bold
silhouette, deep lacquer shadows, muted jewel color and antique gold highlights.
Subject: {技能的一个明确视觉意象}. Two to three major shapes, strong center, readable
at 48 screen pixels. Real transparent alpha outside the circular rim. No text, letters,
numbers, stars, character portraits unless explicitly specified. No neon glow beyond rim.
```

关羽必杀：翠绿龙形刀光围绕一片银色偃月刃；关羽被动：铜金武圣侧像与简化军阵剪影。阵营徽章只生成无字底章，由 Label 写“魏/蜀/吴/群”。

## 8. 验收与返修用语

每张保存 `{heroId}-full-v001.png`、完整提示词、参考文件版本、生成日期、实际像素/alpha、审核记录；批准后升级`approved-v1`，返修另存不覆盖。不要依赖未提供的 seed、模型版本锁或“风格保持100%”承诺。

逐张看：①身份与角色区分；②全身比例和手指/握持；③金属/布料与基准一致；④脸在小卡上可辨；⑤武器不出画；⑥黑/白/绿底无旧背景或大光晕；⑦没有文字、星级、标识；⑧列表/详情同一身份。尺寸与透明检查通过不等于美术已经批准。

返修只改一个问题，例如：

```text
Change ONLY the stray green halo outside the silhouette to fully transparent alpha.
Keep every interior character detail, face, costume, weapon, pose, lighting and size unchanged.
```

```text
Change ONLY the spear grip so the palm wraps naturally around the shaft with five fingers.
Keep face, costume, colors, camera and all other anatomy unchanged.
```

本轮实际用于拆分素材的提示词原文保存在 [assets/](assets/) 下的 `prompt-*.txt`；它们是处理记录，第2～7节才是后续批量生产模板。
