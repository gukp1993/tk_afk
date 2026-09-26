// @ts-nocheck
// Generated from utils/fmt.js by scripts/cocos-sync-domain.js. Do not edit here.

// 数字与文案格式化
function fmtNum(n) {
  n = Math.floor(n || 0);
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '亿';
  if (n >= 1e4) return (n / 1e4).toFixed(1) + '万';
  return '' + n;
}
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function fmtDur(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h > 0) return pad2(h) + ':' + pad2(m) + ':' + pad2(s);
  return pad2(m) + ':' + pad2(s);
}
function todayStr(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
const NUM_CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
function cnNum(n) {
  if (n <= 20) return NUM_CN[n - 1] || '' + n;
  return '' + n;
}
export { fmtNum, fmtDur, todayStr, cnNum, pad2 };
