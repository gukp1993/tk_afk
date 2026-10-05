// 平台适配层：全项目唯一允许直接引用 wx / tt 平台全局的文件
// - 微信小游戏运行时提供 wx；抖音小游戏运行时提供 tt（检测优先 tt，防止抖音环境兼容别名干扰）
// - Node 环境（test / preview/mini 离屏渲染）由外部注入桩：注入 global.tt 识别为 douyin，注入 global.wx 识别为 wechat
const hasTt = typeof tt !== 'undefined' && !!tt;
const hasWx = typeof wx !== 'undefined' && !!wx;
const api = hasTt ? tt : (hasWx ? wx : null);
const name = hasTt ? 'douyin' : (hasWx ? 'wechat' : 'node');

// 震动反馈（研讨会七 P5）：try-catch 防平台不支持
function vibrateShort() { try { if (api && api.vibrateShort) api.vibrateShort({ type: 'light' }); } catch (e) { /* 平台不支持静默 */ } }
function vibrateLong() { try { if (api && api.vibrateLong) api.vibrateLong({ type: 'heavy' }); } catch (e) { /* 静默 */ } }
// 启动/回前台 query（同袍录 Phase A）：微信冷启动 getLaunchOptionsSync、热启动 onShow；无平台/无 API 返回空与 no-op（node/web 兜底）
function launchQuery() {
  try {
    if (api && api.getLaunchOptionsSync) {
      const opt = api.getLaunchOptionsSync();
      return (opt && opt.query) || {};
    }
  } catch (e) { /* 静默 */ }
  return {};
}
function onAppShow(fn) {
  try {
    if (api && api.onShow) {
      const handler = (res) => fn((res && res.query) || {});
      api.onShow(handler);
      return () => { try { if (api.offShow) api.offShow(handler); } catch (e) { /* 静默 */ } };
    }
  } catch (e) { /* 静默 */ }
  return () => {};
}
// 统一返回720宽设计坐标系中的安全区留白；读取失败/网页端返回0，不依赖页面直接访问平台全局。
function safeAreaInsets() {
  try {
    if (!api) return { top: 0, bottom: 0 };
    const info = api.getWindowInfo ? api.getWindowInfo() : (api.getSystemInfoSync ? api.getSystemInfoSync() : null);
    const safe = info && info.safeArea;
    const width = Number(info && (info.windowWidth || info.screenWidth));
    const height = Number(info && (info.screenHeight || info.windowHeight));
    if (!safe || !width || !height) return { top: 0, bottom: 0 };
    const scale = 720 / width;
    return {
      top: Math.max(0, Math.min(100, Number(safe.top || 0) * scale)),
      bottom: Math.max(0, Math.min(100, (height - Number(safe.bottom || height)) * scale))
    };
  } catch (e) { return { top: 0, bottom: 0 }; }
}
module.exports = { name, api, vibrateShort, vibrateLong, launchQuery, onAppShow, safeAreaInsets };
