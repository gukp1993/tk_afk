import { Color } from 'cc';
import { palette, hexColor as tone } from '../ui/CocosUi';
import { ScreenContext } from './ScreenContext';
import * as store from '../domain/store';
import * as config from '../domain/config';

// 新手首见浮层（研讨会四 P1）：场景首次进入时弹一次图文说明，点任意处标记已见。
// 用法：在各 view 渲染末尾调用 firstTimeOverlay(ctx, key)——需晚于页面元素注册以置顶。
export function firstTimeOverlay(ctx: ScreenContext, key: string) {
  const conf = (config as any).TUTORIALS[key];
  if (!conf || (config as any).TUTORIAL_OFF) return;
  if (store.tutorialSeen(key)) return;
  const U = ctx.ui;
  const name = 'Tutorial' + key;
  U.rect(name + 'Shade', 0, 0, 720, 1280, new Color(10, 8, 6, 208));
  U.tap(name + 'ShadeTap', 0, 0, 720, 1280, () => {
    store.markTutorialSeen(key);
    ctx.show(ctx.page);
  });
  U.panel(name + 'Panel', 0, 40, 640, 560, tone('#2a1e12'), 14, palette.gold);
  U.text(name + 'Tag', '初次见面 · 玩法说明', 0, 250, 560, 20, tone('#a99778'));
  U.text(name + 'Title', conf.title, 0, 205, 560, 34, palette.gold);
  (conf.lines as string[]).slice(0, 4).forEach((line, i) => {
    U.text(name + 'Line' + i, '· ' + line, 0, 140 - i * 62, 560, 20, tone('#f0e6cd'));
  });
  U.text(name + 'Go', '知道了 · 点击任意处关闭', 0, -196, 560, 20, palette.gold);
}
