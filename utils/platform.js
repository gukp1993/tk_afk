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
module.exports = { name, api, vibrateShort, vibrateLong };
