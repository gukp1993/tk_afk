import { SpriteFrame, assetManager, resources } from 'cc';

/**
 * 美术资源装载层（2026-10-02 美术阶段开启；同日改分包方案）。
 * 约定：**文件名（不含扩展名）即 key**，两处目录：
 *   assets/art-heroes/<将id>.png  — 武将立绘，配置为微信小游戏分包（不占主包 4MB 限额），
 *                                    启动后异步 loadBundle 预载，未载完页面上先显示占位；
 *   assets/resources/art/icons/<key>.png — 界面图标（seal/指定 artKey 处套用），随主包。
 *   assets/resources/art/ui/ui_<key>.png — 通用按钮/面板/题字，随主包，边框使用九宫格。
 * 页面绘制时同步查表——有图用图，无图回退原占位绘制；美术按 docs/美术资源接入指南.md 逐张交付。
 */
const frames = new Map<string, SpriteFrame>();
let iconsReady = false;
let heroesReady = false;
let scenesReady = false;

export const ArtService = {
  get ready() { return heroesReady; },
  get iconsReady() { return iconsReady; },
  get scenesReady() { return scenesReady; },
  /** 查已加载立绘/图标；未加载或不存在返回 null（调用方回退占位）。 */
  frame(key: string): SpriteFrame | null { return frames.get(key) || null; },
  has(key: string) { return frames.has(key); },
  count() { return frames.size; },
  collect(out: SpriteFrame[]) {
    (out || []).forEach(f => {
      if (!f || !f.name || frames.has(f.name)) return;
      if (f.name.startsWith('ui_') && f.name !== 'ui_logo') {
        f.insetLeft = f.insetRight = 24;
        f.insetTop = f.insetBottom = 16;
      }
      frames.set(f.name, f);
    });
  },
  /** 场景优先：首屏等待场景与界面图；武将立绘继续后台载入，避免旧地图闪现。 */
  preload(done?: (n: number) => void, firstScreenReady?: () => void) {
    let announced = false;
    const checkFirstScreen = () => {
      if (!announced && scenesReady && iconsReady) {
        announced = true;
        firstScreenReady?.();
      }
    };
    resources.loadDir('art', SpriteFrame, (err, out) => {
      this.collect(out as SpriteFrame[]);
      iconsReady = true;
      checkFirstScreen();
      if (done) done(frames.size);
    });
    assetManager.loadBundle('art-heroes', (bErr, bundle) => {
      if (bErr || !bundle) {
        scenesReady = heroesReady = true;
        checkFirstScreen();
        if (done) done(frames.size);
        return;
      }
      bundle.loadDir('scenes', SpriteFrame, (sceneErr, scenes) => {
        this.collect(scenes as SpriteFrame[]);
        scenesReady = true;
        checkFirstScreen();
        if (done) done(frames.size);
        // 已载场景由资源缓存复用；其余立绘和品牌题字不阻塞首屏地图。
        bundle.loadDir('', SpriteFrame, (lErr, out) => {
          this.collect(out as SpriteFrame[]);
          heroesReady = true;
          if (done) done(frames.size);
        });
      });
    });
  }
};
