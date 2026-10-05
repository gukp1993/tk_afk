import { sys } from 'cc';

const runtime: any = globalThis as any;
const miniApi = runtime.tt || runtime.wx;
export const name = runtime.tt ? 'douyin' : runtime.wx ? 'wechat' : 'web';
export const api = miniApi || {
  getStorageSync(key: string) {
    const value = sys.localStorage.getItem(key);
    if (!value) return null;
    try { return JSON.parse(value); } catch (_) { return null; }
  },
  setStorageSync(key: string, value: unknown) {
    sys.localStorage.setItem(key, JSON.stringify(value));
  }
};

// 启动/回前台 query（同袍录 Phase A）：微信冷启动 getLaunchOptionsSync、热启动 onShow；web/无 API 兜底空与 no-op
export function launchQuery(): Record<string, string> {
  try {
    if (miniApi && miniApi.getLaunchOptionsSync) {
      const opt = miniApi.getLaunchOptionsSync();
      return (opt && opt.query) || {};
    }
  } catch (_) { /* 静默 */ }
  return {};
}
export function onAppShow(fn: (query: Record<string, string>) => void): () => void {
  try {
    if (miniApi && miniApi.onShow) {
      const handler = (res: any) => fn((res && res.query) || {});
      miniApi.onShow(handler);
      return () => { try { if (miniApi.offShow) miniApi.offShow(handler); } catch (_) { /* 静默 */ } };
    }
  } catch (_) { /* 静默 */ }
  return () => {};
}
// 统一返回720宽设计坐标系中的安全区留白；读取失败/网页端返回0，不依赖页面直接访问平台全局。
export function safeAreaInsets(): { top: number; bottom: number } {
  try {
    if (!miniApi) return { top: 0, bottom: 0 };
    const info = miniApi.getWindowInfo ? miniApi.getWindowInfo() : (miniApi.getSystemInfoSync ? miniApi.getSystemInfoSync() : null);
    const safe = info && info.safeArea;
    const width = Number(info && (info.windowWidth || info.screenWidth));
    const height = Number(info && (info.screenHeight || info.windowHeight));
    if (!safe || !width || !height) return { top: 0, bottom: 0 };
    const scale = 720 / width;
    return {
      top: Math.max(0, Math.min(100, Number(safe.top || 0) * scale)),
      bottom: Math.max(0, Math.min(100, (height - Number(safe.bottom || height)) * scale))
    };
  } catch (_) { return { top: 0, bottom: 0 }; }
}
