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
