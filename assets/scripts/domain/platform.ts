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
