// 激励视频广告管理器（业务门面：场景/频次/发奖判定/模拟广告 UI，平台接入差异在 ./ads/bridge 桥接层）
// - 配置了 AD.rewardedUnitIds[平台]：走平台激励视频（微信/抖音各自的接入姿势由桥接层处理），看完回调发奖
// - 未配置（当前状态）：内置"模拟广告"全屏播放页（3 秒倒计时→领取奖励），用于上线前测试完整流程
const C = require('../utils/config');
const store = require('../utils/store');
const platform = require('../utils/platform');
const bridge = require('./ads/bridge');
const { ui } = require('./ui');
const T = require('./theme');

const state = { mock: null };

function rewardedUnitId() {
  const ids = C.AD.rewardedUnitIds || {};
  return ids[platform.name] || '';
}

function isConfigured() {
  return !!(rewardedUnitId() && bridge.available());
}

// 返回 true 表示已开始流程（同步）；结果经 onReward/onFail 异步回调
function showRewarded(placement, onReward, onFail) {
  const conf = C.AD.placements[placement];
  if (!conf) { onFail && onFail('未知广告场景'); return false; }
  if (store.adCount(placement) >= conf.limit) { onFail && onFail('今日"看广告' + conf.name + '"次数已用完'); return false; }

  if (!isConfigured()) return showMock(placement, onReward, onFail);

  try {
    bridge.createRewarded(rewardedUnitId()).show().then(({ ended }) => {
      if (ended) {
        store.adBump(placement);
        onReward && onReward();
      } else {
        onFail && onFail('未看完广告，无奖励');
      }
    }).catch(() => {
      onFail && onFail('广告拉取失败，稍后再试');
    });
    return true;
  } catch (e) {
    onFail && onFail('广告暂不可用');
    return false;
  }
}

// 内置模拟广告（测试模式）
function showMock(placement, onReward) {
  const conf = C.AD.placements[placement];
  state.mock = {
    placement, name: conf.name, t: 0, dur: 3,
    onDone: () => {
      store.adBump(placement);
      onReward && onReward();
    }
  };
  return true;
}

function closeMock(reward) {
  const m = state.mock;
  if (!m) return;
  state.mock = null;
  if (reward && m.onDone) m.onDone();
}

// 由 app 主循环每帧调用（在场景与 tabbar 之后绘制，保证覆盖其点击）
function frame(dt) {
  const m = state.mock;
  if (!m) return;
  m.t += dt;
  const ctx = ui.ctx;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  ctx.fillRect(0, 0, ui.W, ui.H);
  ctx.restore();
  ui.hitAreas = []; ui.dragAreas = [];
  ui.tap(0, 0, ui.W, ui.H, () => {}, 'ad-mask'); // 阻挡点击与滚动穿透

  const w = 300, h = 200, x = (ui.W - w) / 2, y = (ui.H - h) / 2 - 20;
  ui.panel(x, y, w, h, { ornate: true });
  ui.text('模拟广告（测试模式）', x + w / 2, y + 12, { size: 15, color: T.GOLD_HI, bold: true, align: 'center' });
  ui.text('场景：' + m.name, x + w / 2, y + 36, { size: 11, color: T.DIM, align: 'center' });

  // 模拟广告画面
  const pw = w - 48, ph = 64;
  ui.ctx.save();
  ui.ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ui.ctx.fillRect(x + 24, y + 56, pw, ph);
  ui.ctx.restore();
  ui.ctx.strokeStyle = T.LINE;
  ui.ctx.strokeRect(x + 24.5, y + 56.5, pw, ph);
  ui.text('📺', x + w / 2, y + 66, { size: 26, align: 'center' });

  const p = Math.min(1, m.t / m.dur);
  ui.bar(x + 24, y + 130, w - 48, 7, p, 'blue');
  ui.text(p < 1 ? '广告播放中… ' + Math.ceil(m.dur - m.t) + 's' : '播放完成', x + w / 2, y + 141, { size: 11, color: T.DIM, align: 'center' });

  if (p >= 1) {
    ui.btn(x + 60, y + 160, w - 120, 30, {
      text: '领取奖励', style: 'gold', size: 14, id: 'ad-claim',
      cb: () => closeMock(true)
    });
  } else {
    ui.text('提前关闭将无奖励', x + w / 2, y + 166, { size: 10, color: T.DIM, align: 'center' });
  }
  ui.text('✕ 关闭', x + w - 34, y + 5, { size: 11, color: T.DIM });
  ui.tap(x + w - 44, y + 3, 40, 18, () => closeMock(false), 'ad-close');
}

function remaining(placement) {
  const conf = C.AD.placements[placement];
  return conf ? Math.max(0, conf.limit - store.adCount(placement)) : 0;
}

module.exports = { showRewarded, isConfigured, remaining, frame, state };
