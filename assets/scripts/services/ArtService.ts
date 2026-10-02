import { SpriteFrame, resources } from 'cc';

/**
 * 美术资源装载层（2026-10-02 美术阶段开启）。
 * 约定：图片放 assets/resources/art/ 下，**文件名（不含扩展名）即 key**：
 *   art/heroes/<将id>.png   — 武将立绘（heroIcon 自动套用）
 *   art/icons/<key>.png     — 界面图标（seal/指定 artKey 处套用）
 * 启动时 loadDir 一次全量预加载；页面绘制时同步查表——有图用图，无图回退原占位绘制。
 * 美术可按 docs/美术资源接入指南.md 逐张交付，不需要一次齐、不需要改代码。
 */
const frames = new Map<string, SpriteFrame>();
let ready = false;

export const ArtService = {
  get ready() { return ready; },
  /** 查已加载立绘/图标；未加载或不存在返回 null（调用方回退占位）。 */
  frame(key: string): SpriteFrame | null { return frames.get(key) || null; },
  has(key: string) { return frames.has(key); },
  count() { return frames.size; },
  preload(done?: (n: number) => void) {
    resources.loadDir('art', SpriteFrame, (err, out) => {
      if (!err && out) {
        (out as SpriteFrame[]).forEach(f => { if (f && f.name && !frames.has(f.name)) frames.set(f.name, f); });
      }
      ready = true;
      if (done) done(frames.size);
    });
  }
};
