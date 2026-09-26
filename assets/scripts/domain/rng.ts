// @ts-nocheck
// Generated from utils/rng.js by scripts/cocos-sync-domain.js. Do not edit here.

// 可播种随机数（mulberry32），保证战斗可复现
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeRng(seed) {
  const f = mulberry32(seed || 1);
  return {
    next: f,
    int(min, max) { return min + Math.floor(f() * (max - min + 1)); },
    range(min, max) { return min + f() * (max - min); },
    chance(p) { return f() < p; },
    pick(arr) { return arr[Math.floor(f() * arr.length)]; },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(f() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }
  };
}
export { makeRng, mulberry32 };
