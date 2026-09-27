# 三页背景生成记录

使用内置 **ImageGen**，每页分别生成一张原创无字背景，未使用第三方游戏截图。三张最终图位于 `assets/`，均为竖向 1024×1536 PNG；原型中通过 CSS 叠加可编辑 UI。以下为最终英文提示词；`transparent_background: false`。

## 主城 `city-bg-v1.png`

```text
Use case: stylized-concept. Asset type: original vertical 2:3 background painting for a Three Kingdoms mobile idle-card game's MAIN CITY lobby. A dramatic but calm ancient Chinese walled capital seen from a high three-quarter viewpoint, with six distinct readable architectural destinations distributed across winding stone terraces: a grand recruitment terrace and beacon near upper center, an ornate heroes hall on left middle, a circular training arena on right middle, a warm smithy on left lower terrace, a lantern market on right lower terrace, and a small military command camp near lower middle. Architectural forms should be geographically coherent with an S-shaped walkable stone route, walls, cypress, banners without writing, distant mountains and ink-wash mist. Visual language matching a premium dark Three Kingdoms hero-collection screen: painterly hand-brushed ink and detailed muted realism, deep lacquer green #102824, charcoal blue-green, antique copper-gold highlights, parchment grain, atmospheric smoke, soft warm light on roof eaves, elegant Chinese historical roof silhouettes. Keep top 15 percent and bottom 22 percent quieter and darker so UI labels can be overlaid; buildings remain recognizable through the middle. No characters, no readable text, no letters, no iconography, no user interface, no frame, no watermark. Portrait composition, not a screenshot.
```

## 玩法 `journey-bg-v1.png`

```text
Use case: stylized-concept. Asset type: original vertical 2:3 background painting for a Three Kingdoms mobile idle-card game's GAME MODES hub, visually matching a premium dark-ink hero roster and main-city painting. A solemn imperial palace corridor looking toward a distant bronze-lit throne hall, carved pillars and hanging blank war banners framing left and right, layered ink-wash mountains and a faint pagoda/tower silhouette beyond an open courtyard; antique scrolls and stone paving in foreground. Deep lacquer green #102824 and charcoal teal shadows, restrained aged copper gold edge lighting, mist, parchment grain, refined painterly brush texture, subtle atmospheric depth. Keep the central 70 percent relatively calm and low-contrast so four large game-mode cards can sit above it; top 15 percent clear for a title and resource header, bottom 20 percent dark for navigation. Dramatic but not cluttered, visually related to historical Chinese city painting. No characters, no readable words, no icons, no UI panels, no frames, no watermark. Portrait composition, not a screenshot.
```

## 战役 `campaign-bg-v1.png`

```text
Use case: stylized-concept. Asset type: original vertical 2:3 background painting for a Three Kingdoms mobile idle-card game's CAMPAIGN MAP screen. A moody bird's-eye ink-and-watercolor landscape from a high oblique view: a winding S-shaped ancient road crossing two stone bridges and a teal river, weaving through dark cypress groves, misty valleys, small Han-dynasty frontier watchtowers and one distant fortified mountain pass. Show five subtle clearings or terraces distributed up the road that can receive interactive stage markers later; the road itself should guide the eye from bottom-left toward upper-center. Same premium visual language as dark green lacquer Three Kingdoms hero roster: charcoal teal and muted jade, low saturation, antique gold touches on distant roofs, fine parchment grain, atmospheric ink wash, dramatic mist; detailed terrain but subdued contrast for overlaid map labels. Reserve top 16 percent as quiet distant mountains for a title/resource header; lower 26 percent a darker, less detailed area for an idle reward panel and navigation. No characters, no readable text, no numbers, no flags with writing, no UI panels, no icons, no frame, no watermark. Portrait background only, not a screenshot.
```

绘画画面用于视觉原型，不保证建筑、道路像素位置直接适合游戏热区。正式接入时，地点标签和关卡按钮应由独立节点定位，可点击区域必须按设备安全区与短屏视口调整。
