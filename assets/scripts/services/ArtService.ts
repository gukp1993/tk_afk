import { Node, SpriteFrame, assetManager, resources } from 'cc';

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
let heroBundle: any = null;
const portraitIds = new Set<string>();
const portraitLoads = new Map<string, Array<{ owner: Node; generation: number; done: (frame: SpriteFrame | null) => void }>>();
let portraitGeneration = 0;

export const ArtService = {
  get ready() { return heroesReady; },
  get iconsReady() { return iconsReady; },
  get scenesReady() { return scenesReady; },
  /** 查已加载立绘/图标；未加载或不存在返回 null（调用方回退占位）。 */
  frame(key: string): SpriteFrame | null { return frames.get(key) || null; },
  has(key: string) { return frames.has(key); },
  /** Portraits are decoded only when a live UI needs them; callers may safely request the same id concurrently. */
  loadPortrait(id: string, owner: Node, done: (frame: SpriteFrame | null) => void) {
    const cached = frames.get(id);
    if (cached) { if (owner.isValid) done(cached); return; }
    if (!heroBundle) { if (owner.isValid) done(null); return; }
    const pending = portraitLoads.get(id);
    const waiter = { owner, generation: portraitGeneration, done };
    if (pending) { pending.push(waiter); return; }
    portraitLoads.set(id, [waiter]);
    // 实证（探针 artprobe5）：分包内按 `<将id>/spriteFrame` 路径加载成功（按裸 id 查不到——构建产物 paths 键是 uuid）
    const releaseKey = id + '/spriteFrame';
    heroBundle.load(releaseKey, SpriteFrame, (err: Error | null, frame: SpriteFrame | null) => {
      const callbacks = portraitLoads.get(id) || [];
      portraitLoads.delete(id);
      const active = callbacks.filter(cb => cb.generation === portraitGeneration && cb.owner.isValid);
      if (!err && frame && active.length) {
        frames.set(id, frame);
        portraitIds.add(releaseKey);
      } else if (!err && frame) {
        heroBundle.release(releaseKey, SpriteFrame);
      }
      active.forEach(cb => cb.done(!err ? frame : null));
    });
  },
  /** Called after old page nodes are destroyed. Releases decoded portrait textures before the next page loads its needs. */
  releasePortraits() {
    portraitGeneration++;
    if (heroBundle) portraitIds.forEach(id => heroBundle.release(id, SpriteFrame));
    portraitIds.forEach(key => frames.delete(key.replace('/spriteFrame', '')));
    portraitIds.clear();
  },
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
      if (done) done(frames.size);
      checkFirstScreen();
    });
    assetManager.loadBundle('art-heroes', (bErr, bundle) => {
      if (bErr || !bundle) {
        scenesReady = heroesReady = true;
        checkFirstScreen();
        if (done) done(frames.size);
        return;
      }
      heroBundle = bundle;
      heroesReady = true;
      bundle.loadDir('scenes', SpriteFrame, (sceneErr, scenes) => {
        this.collect(scenes as SpriteFrame[]);
        scenesReady = true;
        if (done) done(frames.size);
        checkFirstScreen();
      });
      // Preload the arena while first-screen artwork is decoding; it is shown as soon as battle begins.
      bundle.load('battles/bg_main/spriteFrame', SpriteFrame, (battleErr, battleFrame) => {
        if (!battleErr && battleFrame) this.collect([battleFrame]);
      });
      // Portraits load by visible hero id to avoid decoding the entire subpackage into memory.
    });
  }
};
