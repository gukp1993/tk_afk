// @ts-nocheck
// Generated from scripts/rewarded-bridge.js. Do not edit here.
import * as __platform from '../domain/platform';
// 广告桥接层：自定义统一广告 API，微信 / 抖音的接入差异到此为止
// 统一契约：createRewarded(adUnitId) → { preload(), show() → Promise<{ended:boolean}> }
//   resolve({ended:true})   看完（平台未回传结果时按看完处理，与历史行为一致）
//   resolve({ended:false})  提前关闭，不发奖
//   reject(err)             广告拉取/展示失败
// 平台实现差异：
// - 微信：show 会自动拉取，失败后 load→show 重试一次；show 失败时 promise rejection 与 onError
//   同时出现，失败判定只走 promise 链（否则 onError 会打断重试）
// - 抖音：官方推荐 load 在前 show 在后，每次 show 前重新 load（关播后需重拉）
// - 兜底：部分老基础库的 show()/load() 不返回 Promise——同步调用不抛错即视为已发起，
//   结果交给 onClose/onError 事件；此时 onError 才参与失败判定
const platform = __platform;
const api = platform.api;

function isPromise(p) { return !!p && typeof p.then === 'function'; }

// 防御调用：同步抛错转为 rejected Promise；未返回 Promise 时返回 undefined
function safeCall(ad, method) {
  try { return ad[method](); } catch (e) { return Promise.reject(e); }
}

// 接线 onClose/onError，终态时自动解绑；promiseSeen.seen 为真时 onError 视为同源噪音
function wire(ad, promiseSeen, onEnded, onFail) {
  const onClose = (res) => {
    cleanup();
    onEnded(!(res && res.isEnded === false));
  };
  const onError = (err) => {
    if (promiseSeen.seen) return;
    cleanup();
    onFail(err || new Error('rewarded ad error'));
  };
  const cleanup = () => {
    ad.offClose && ad.offClose(onClose);
    ad.offError && ad.offError(onError);
  };
  ad.onClose && ad.onClose(onClose);
  ad.onError && ad.onError(onError);
  return cleanup;
}

// 微信实现：show 优先，失败自动 load→show 重试一次
function wechatRewarded(ad) {
  return {
    preload() {
      const p = safeCall(ad, 'load');
      if (isPromise(p)) p.catch(() => {});
    },
    show() {
      return new Promise((resolve, reject) => {
        const promiseSeen = { seen: false };
        const cleanup = wire(ad, promiseSeen, (ended) => resolve({ ended }), reject);
        const fail = (e) => { cleanup(); reject(e); };
        const attempt = () => {
          const p = safeCall(ad, 'show');
          if (isPromise(p)) { promiseSeen.seen = true; return p; }
          return Promise.resolve(); // 未返回 Promise：同步未抛错即视为已发起，结果交给事件
        };
        attempt().catch(() => {
          const lp = safeCall(ad, 'load');
          Promise.resolve(isPromise(lp) ? lp : undefined).then(() => {
            attempt().catch(fail); // 重拉后仍失败才判失败
          }).catch(fail);
        });
      });
    }
  };
}

// 抖音实现：load 在前 show 在后，每次 show 前重新 load
function douyinRewarded(ad) {
  return {
    preload() {
      const p = safeCall(ad, 'load');
      if (isPromise(p)) p.catch(() => {});
    },
    show() {
      return new Promise((resolve, reject) => {
        const promiseSeen = { seen: false };
        const cleanup = wire(ad, promiseSeen, (ended) => resolve({ ended }), reject);
        const fail = (e) => { cleanup(); reject(e); };
        const lp = safeCall(ad, 'load');
        Promise.resolve(isPromise(lp) ? lp : undefined).then(() => {
          const p = safeCall(ad, 'show');
          if (isPromise(p)) { promiseSeen.seen = true; p.catch(fail); }
          // 未返回 Promise：结果交给事件
        }).catch(fail);
      });
    }
  };
}

const IMPLS = { wechat: wechatRewarded, douyin: douyinRewarded };
const instances = {}; // adUnitId → 实例（官方要求单例，重复创建会导致重复播放）

function available() {
  return !!(api && api.createRewardedVideoAd);
}

function createRewarded(adUnitId) {
  if (!available()) throw new Error('当前平台无激励视频广告 API');
  if (!instances[adUnitId]) {
    const impl = IMPLS[platform.name] || wechatRewarded; // 其余平台按同形 API 走微信实现兜底
    instances[adUnitId] = impl(api.createRewardedVideoAd({ adUnitId }));
  }
  return instances[adUnitId];
}

export { available, createRewarded };
