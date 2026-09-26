// 页面切换时使旧按压失效；正常同控件按下/抬起仍触发。
const assert = require('assert');
const { ui } = require('../src/ui');
ui.begin({}, 375, 812, 0.016);
let calls = 0;
ui.tap(10, 10, 80, 40, () => calls++, 'action');
ui.onTouchStart(20, 20);
ui.invalidateTouches();
ui.onTouchEnd(20, 20);
assert.strictEqual(calls, 0, 'a touch from the old page cannot activate a new page control');

ui.begin({}, 375, 812, 0.016);
ui.tap(10, 10, 80, 40, () => calls++, 'action');
ui.onTouchStart(20, 20);
ui.onTouchEnd(20, 20);
assert.strictEqual(calls, 1, 'a valid same-control tap still works');
console.log('ui-touch-generation: 2 assertions passed');
