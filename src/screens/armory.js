// 全军共用军械图鉴：图鉴解锁、部位星级和当前配装都属于账号。
const { app, ui } = require('../app');
const T = require('../theme');
const store = require('../../utils/store');
const items = require('../../utils/items');
const F = require('../../utils/fmt');

const SLOT_FALLBACK = [
  { key: 'weapon', name: '兵刃' }, { key: 'armor', name: '铠甲' },
  { key: 'helm', name: '头盔' }, { key: 'boots', name: '战靴' },
  { key: 'jade', name: '玉佩' }, { key: 'seal', name: '兵符' }
];
const ATTR_NAMES = { atk: '攻击', hp: '生命', def: '防御', spd: '攻速' };

function slotList() {
  const source = items.ARMORY_SLOTS;
  if (!Array.isArray(source) || !source.length) return SLOT_FALLBACK;
  return source.map((s, i) => typeof s === 'string'
    ? { key: s, name: SLOT_FALLBACK.find(x => x.key === s)?.name || s }
    : { ...s, key: s.key || s.id || s.slot || SLOT_FALLBACK[i]?.key, name: s.name || SLOT_FALLBACK[i]?.name || s.key });
}
function catalogList() {
  const source = items.ARMORY_CATALOG || items.CATALOG;
  if (Array.isArray(source)) return source;
  if (source && typeof source === 'object') return Object.keys(source).map(k => source[k]);
  return [];
}
function getGrade(q) {
  const grades = items.ARMORY_GRADES || items.GRADES || {};
  return Array.isArray(grades) ? grades.find(g => g.q === q || g.id === q) : grades[q] || grades['q' + q] || {};
}
function qualityName(q) {
  const g = getGrade(q);
  return g.name || g.label || ({ 1: '凡铁', 2: '精钢', 3: '百炼', 4: '名器' }[q] || ('品质' + q));
}
function qualityColor(q) {
  const g = getGrade(q);
  return g.color || ({ 1: '#c8ccd4', 2: T.BLUE, 3: T.PURPLE, 4: T.GOLD_HI }[q] || T.DIM);
}
function starAt(map, slot) { return Math.max(0, Number(map && map[slot]) || 0); }
function asPercent(n) {
  const v = Number(n) || 0;
  return (Math.abs(v) <= 1 ? v * 100 : v).toFixed(0) + '%';
}
function pctText(pct) {
  if (typeof pct === 'string') return pct;
  if (!pct || typeof pct !== 'object') return '—';
  return Object.keys(pct).filter(k => ATTR_NAMES[k] && Number(pct[k])).map(k => ATTR_NAMES[k] + '+' + asPercent(pct[k])).join('  ') || '—';
}
function effectText(effect) {
  if (!effect) return '';
  if (typeof effect === 'object') return effect.text || effect.desc || '';
  return ({ heal: '主动治疗与持续治疗效果提升', shield: '战斗开始时为全体英雄提供护盾', energy: '战斗开始时增加全体英雄怒气', reduction: '降低全体英雄受到的直接伤害' })[effect] || '';
}
function bonusText(bonuses) {
  if (!bonuses) return '—';
  const parts = Object.keys(bonuses).map(k => {
    const v = Number(bonuses[k]);
    if (!v) return '';
    if (ATTR_NAMES[k]) return ATTR_NAMES[k] + '+' + asPercent(v);
    if (k === 'heal') return '治疗+' + asPercent(v);
    if (k === 'startShield') return '开场护盾 ' + asPercent(v);
    if (k === 'startEnergy') return '开场怒气+' + v;
    if (k === 'directDR') return '直接伤害减免 ' + asPercent(v);
    return '';
  }).filter(Boolean);
  return parts.join('  ') || '暂无属性加成';
}
function scaledPctObject(pct, star) {
  const out = {};
  if (!pct || typeof pct !== 'object') return out;
  const mult = 1 + (Number(items.STAR_PCT) || 0) * star;
  Object.keys(pct).forEach(k => { if (ATTR_NAMES[k]) out[k] = Number(pct[k]) * mult; });
  return out;
}
function upgradeDelta(pct) {
  const out = {};
  if (!pct || typeof pct !== 'object') return out;
  const rate = Number(items.STAR_PCT) || 0;
  Object.keys(pct).forEach(k => { if (ATTR_NAMES[k]) out[k] = Number(pct[k]) * rate; });
  return out;
}

module.exports = {
  name: 'armory',
  scroll: {}, scrollReg: {},
  mode: 'overview', selectedSlot: 'weapon', detailId: null, boxQ: null,
  confirm: null,

  onEnter() { this.mode = 'overview'; this.detailId = null; this.boxQ = null; this.refresh(); },
  refresh() {
    const s = store.getState();
    this.s = s;
    this.armory = (typeof store.getArmoryState === 'function' && store.getArmoryState()) || s.armory || { unlocked: {}, selected: {}, slotStars: {}, boxes: {}, seen: {}, claimedMilestones: {} };
    this.slots = slotList();
    this.catalog = catalogList();
    if (!this.slots.some(x => x.key === this.selectedSlot)) this.selectedSlot = this.slots[0]?.key || 'weapon';
    if (!this.detailId || !this.catalog.some(x => x.id === this.detailId)) this.detailId = this.catalog.find(x => x.slot === this.selectedSlot)?.id || null;
  },
  update() { if (!this.s) this.refresh(); },

  draw() {
    app.pageHeader('全军军械');
    this.refresh();
    this.drawResources();
    ui.chipBtn(9, 70, 174, 28, '部位养成', this.mode === 'overview', () => { this.mode = 'overview'; this.detailId = null; this.boxQ = null; }, 'armory-overview');
    ui.chipBtn(192, 70, 174, 28, '装备图鉴  ' + this.unlockedCount() + '/' + this.catalog.length, this.mode === 'catalog', () => { this.mode = 'catalog'; this.detailId = this.currentItem(this.selectedSlot)?.id || this.catalog.find(x => x.slot === this.selectedSlot)?.id || null; }, 'armory-catalog');
    if (this.mode === 'overview') this.drawOverview(); else this.drawCatalog();
    if (this.confirm) this.drawConfirm();
  },
  drawResources() {
    const res = this.s.res || {};
    [['精铁', res.iron], ['铜钱', res.gold]].forEach(([name, value], i) => {
      const x = 10 + i * 180;
      ui.panel(x, 45, 174, 20, { fill: 'rgba(0,0,0,0.24)', r: 8 });
      ui.text(name + '  ' + F.fmtNum(value || 0), x + 87, 49, { size: 10, color: T.GOLD_HI, align: 'center' });
    });
  },
  unlockedCount() { return this.catalog.filter(x => this.armory.unlocked && this.armory.unlocked[x.id]).length; },
  currentItem(slot) {
    const id = this.armory.selected && this.armory.selected[slot];
    return this.catalog.find(x => x.id === id) || null;
  },
  slotName(slot) { return this.slots.find(x => x.key === slot)?.name || slot; },
  starNeed(star) {
    const arr = items.ARMORY_STAR_NEEDS || items.STAR_NEEDS || [];
    return Array.isArray(arr) ? arr[star] : arr[star] || arr['star' + star] || null;
  },
  starGold(star) {
    const arr = items.ARMORY_STAR_GOLD || items.STAR_GOLD || [];
    return Array.isArray(arr) ? arr[star] : arr[star] || arr['star' + star] || 0;
  },
  drawOverview() {
    const top = 108, gap = 8, cardW = (app.W - 24) / 2, cardH = 116;
    const contentH = 600;
    ui.beginScroll(this, 'overview', 0, top, app.W, app.H - top, contentH);
    ui.text('一套军械，全体英雄同时生效', 187.5, 114, { size: 11, color: T.DIM, align: 'center' });
    this.slots.forEach((slot, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 8 + col * (cardW + gap), y = 139 + row * (cardH + 9);
      const item = this.currentItem(slot.key), star = starAt(this.armory.slotStars, slot.key);
      ui.panel(x, y, cardW, cardH, { ornate: true });
      ui.text(slot.name, x + 11, y + 9, { size: 14, color: T.GOLD_HI, bold: true });
      ui.text('★' + star, x + cardW - 10, y + 10, { size: 13, color: T.GOLD, bold: true, align: 'right' });
      if (item) {
        ui.text(item.name, x + 11, y + 34, { size: 12, color: qualityColor(item.q), bold: true });
        ui.text(qualityName(item.q) + ' · ' + pctText(item.basePct || item.stats), x + 11, y + 54, { size: 9, color: T.DIM });
        if (item.effect) ui.wrap(effectText(item.effect), x + 11, y + 69, cardW - 22, 12, { size: 9, color: T.DIM });
      } else {
        ui.text('尚未选择军械', x + 11, y + 39, { size: 11, color: T.DIM });
      }
      ui.btn(x + 9, y + 86, cardW - 18, 23, { text: '查看图鉴', style: 'ghost', size: 10, id: 'armory-slot-' + slot.key, cb: () => this.openSlot(slot.key) });
    });
    let y = 139 + Math.ceil(this.slots.length / 2) * (cardH + 9) + 2;
    const pct = this.totalPct();
    ui.panel(8, y, app.W - 16, 55);
    ui.text('全军属性与战术效果', 19, y + 8, { size: 11, color: T.GOLD_HI, bold: true });
    ui.text(bonusText(pct), 19, y + 29, { size: 10, color: T.DIM });
    y += 64;
    ui.text('重复获得的军械会转为精铁；部位升星后，全体英雄共同受益。', 16, y, { size: 9, color: T.DIM });
    ui.endScroll();
  },
  totalPct() {
    if (typeof store.getArmoryBonuses === 'function') return store.getArmoryBonuses();
    return {};
  },
  openSlot(slot) {
    this.selectedSlot = slot; this.mode = 'catalog'; this.boxQ = null;
    this.detailId = this.currentItem(slot)?.id || this.catalog.find(x => x.slot === slot)?.id || null;
  },
  drawCatalog() {
    const y0 = 108;
    const contentH = 860;
    ui.beginScroll(this, 'catalog', 0, y0, app.W, app.H - y0, contentH);
    this.slots.forEach((slot, i) => {
      const col = i % 3, row = Math.floor(i / 3), x = 9 + col * 122, y = 113 + row * 31;
      ui.chipBtn(x, y, 116, 25, slot.name, this.selectedSlot === slot.key, () => {
        this.selectedSlot = slot.key; this.boxQ = null;
        this.detailId = this.currentItem(slot.key)?.id || this.catalog.find(x => x.slot === slot.key)?.id || null;
      }, 'armory-filter-' + slot.key);
    });
    let y = 181;
    ui.text(this.slotName(this.selectedSlot) + ' · 部位 ★' + starAt(this.armory.slotStars, this.selectedSlot), 13, y, { size: 12, color: T.GOLD_HI, bold: true });
    const maxStar = (items.ARMORY_STAR_NEEDS || items.STAR_NEEDS || []).length;
    ui.btn(242, y - 5, 120, 26, { text: '部位升星', style: 'gold', size: 11, id: 'armory-upgrade', disabled: starAt(this.armory.slotStars, this.selectedSlot) >= maxStar, cb: () => { this.confirm = { type: 'upgrade', slot: this.selectedSlot }; } });
    y += 31;
    const slotItems = this.catalog.filter(x => x.slot === this.selectedSlot).sort((a, b) => a.q - b.q || a.name.localeCompare(b.name));
    slotItems.forEach((item, i) => {
      const rowY = y + i * 43, selected = this.detailId === item.id;
      ui.panel(9, rowY, app.W - 18, 38, { fill: selected ? 'rgba(217,169,78,0.14)' : undefined, r: 5 });
      ui.text(item.name, 18, rowY + 6, { size: 11, color: qualityColor(item.q), bold: true });
      const status = this.armory.unlocked[item.id] ? (this.currentItem(this.selectedSlot)?.id === item.id ? '全军启用' : '已解锁') : '未解锁';
      ui.text(qualityName(item.q) + ' · ' + pctText(item.basePct || item.stats) + ' · ' + status, 18, rowY + 22, { size: 8, color: T.DIM });
      ui.tap(9, rowY, app.W - 18, 38, () => { this.detailId = item.id; this.boxQ = null; }, 'armory-item-' + item.id);
    });
    y += slotItems.length * 43 + 7;
    ui.wrap(this.dropOddsText(), 13, y, app.W - 26, 12, { size: 8, color: T.DIM });
    y += 20;
    const boxEntries = this.availableBoxes();
    if (boxEntries.length) {
      ui.text('待选择的军械箱', 13, y, { size: 11, color: T.GOLD_HI, bold: true }); y += 22;
      boxEntries.forEach((box, i) => {
        ui.btn(10 + (i % 3) * 120, y + Math.floor(i / 3) * 30, 112, 25, { text: qualityName(box.q) + '箱 ×' + box.count, style: this.boxQ === box.q ? 'gold' : 'ghost', size: 9, id: 'armory-box-' + box.q, cb: () => { this.boxQ = this.boxQ === box.q ? null : box.q; this.detailId = null; } });
      });
      y += Math.ceil(boxEntries.length / 3) * 32;
      if (this.boxQ) {
        ui.text('选择一件' + qualityName(this.boxQ) + '军械领取', 13, y, { size: 10, color: T.DIM }); y += 18;
        this.catalog.filter(x => x.q === this.boxQ).forEach((item, i) => {
          const xx = 10 + (i % 3) * 120, yy = y + Math.floor(i / 3) * 29;
          ui.btn(xx, yy, 112, 24, { text: item.name, style: this.detailId === item.id ? 'gold' : 'plain', size: 8, id: 'armory-box-item-' + item.id, cb: () => { this.detailId = item.id; } });
        });
        const count = this.catalog.filter(x => x.q === this.boxQ).length;
        y += Math.ceil(count / 3) * 30;
        ui.btn(10, y, app.W - 20, 24, { text: '本品质已收集齐？将军械箱转为精铁', style: 'ghost', size: 9, id: 'armory-box-convert', cb: () => { this.detailId = 'convert'; } });
        y += 29;
      }
    }
    y += 4;
    this.drawDetail(this.catalog.find(x => x.id === this.detailId), y);
    ui.endScroll();
  },
  availableBoxes() {
    const boxes = this.armory.boxes || {};
    return [1, 2, 3].map(q => ({ q, count: Number(boxes[q] || boxes['q' + q]) || 0 })).filter(x => x.count > 0);
  },
  drawDetail(item, y) {
    if (this.detailId === 'convert' && this.boxQ) {
      const x = 9, w = app.W - 18;
      ui.panel(x, y, w, 85, { ornate: true });
      ui.text(qualityName(this.boxQ) + '军械箱转化', x + 11, y + 10, { size: 13, color: T.GOLD_HI, bold: true });
      ui.wrap('当该品质图鉴已全部解锁时，可将这一箱转为精铁。', x + 11, y + 34, w - 22, 13, { size: 9, color: T.DIM });
      ui.btn(x + 10, y + 56, w - 20, 23, { text: '转为精铁', style: 'gold', size: 10, id: 'armory-box-convert-confirm', cb: () => this.runAction('claimBox', this.boxQ, 'convert') });
      return;
    }
    if (!item) return;
    const x = 9, w = app.W - 18, star = starAt(this.armory.slotStars, item.slot), unlocked = !!this.armory.unlocked[item.id];
    const body = effectText(item.effect);
    const source = typeof item.source === 'string' ? item.source : item.source && (item.source.text || item.source.desc) || this.sourceText(item);
    const h = 180;
    ui.panel(x, y, w, h, { ornate: true });
    ui.text(item.name, x + 11, y + 10, { size: 15, color: qualityColor(item.q), bold: true });
    ui.text(this.slotName(item.slot) + ' · ' + qualityName(item.q) + ' · 部位★' + star, x + 11, y + 34, { size: 10, color: T.DIM });
    ui.text('基础加成：' + pctText(item.basePct || item.stats) + ' · 部位星级 ★' + star, x + 11, y + 53, { size: 10, color: T.GOLD_HI });
    if (body) ui.wrap('效果：' + body, x + 11, y + 73, w - 22, 13, { size: 9, color: T.TEXT });
    if (source) ui.wrap('获得：' + source, x + 11, y + 100, w - 22, 12, { size: 8, color: T.DIM });
    const active = this.currentItem(item.slot);
    const currentLine = active ? '当前：' + active.name + '（' + pctText(scaledPctObject(active.basePct || active.stats, star)) + '）' : '当前：未配置';
    ui.text(currentLine, x + 11, y + 123, { size: 8, color: T.DIM });
    const btnY = y + 145, btnW = (w - 30) / 2;
    if (this.boxQ) {
      const boxItems = this.catalog.filter(x => x.q === this.boxQ);
      const already = !!this.armory.unlocked[item.id];
      ui.btn(x + 10, btnY, w - 20, 25, { text: already ? '此装备已解锁，请选择其他装备' : '使用军械箱领取', style: 'gold', size: 10, disabled: already || item.q !== this.boxQ, id: 'armory-claim-box', cb: () => this.runAction('claimBox', this.boxQ, item.id) });
      if (!boxItems.length) ui.text('该品质没有可选军械', x + 12, btnY + 26, { size: 8, color: T.DIM });
    } else if (unlocked) {
      const activeNow = active && active.id === item.id;
      ui.btn(x + 10, btnY, w - 20, 25, { text: activeNow ? '全军正在使用' : '全军启用', style: activeNow ? 'ghost' : 'gold', size: 10, disabled: activeNow, id: 'armory-select', cb: () => this.runAction('select', item.id) });
    } else {
      const unlockStage = this.unlockStage(item.q, item);
      const available = this.stageNo() >= Number(unlockStage || 0);
      const cost = this.unlockCost(item.q);
      const msg = available ? '精铁 ×' + cost + ' 解锁' : '通关第' + unlockStage + '关后开放';
      ui.btn(x + 10, btnY, w - 20, 25, { text: msg, style: 'gold', size: 10, disabled: !available || cost == null, id: 'armory-unlock', cb: () => { this.confirm = { type: 'unlock', itemId: item.id }; } });
    }
  },
  unlockStage(q, item) {
    const g = getGrade(q);
    return item.unlockStage !== undefined ? item.unlockStage : g.unlockStage || 0;
  },
  sourceText(item) {
    const stage = this.unlockStage(item.q, item);
    return Number(item.q) === 0 ? '新手赠送与战役奖励' : '战役奖励；通关第' + stage + '关后可用精铁定向解锁';
  },
  stageNo() {
    const s = this.s || {};
    if (s.campaign && Number(s.campaign.cleared)) return Number(s.campaign.cleared);
    if (s.progress && Number(s.progress.stage)) return Number(s.progress.stage);
    if (s.campaign && Number(s.campaign.stage)) return Number(s.campaign.stage);
    return Number(s.stage) || 1;
  },
  unlockCost(q) {
    const grades = items.ARMORY_GRADES || items.GRADES || {};
    const g = Array.isArray(grades) ? grades.find(x => x.q === q || x.id === q) : grades[q] || grades['q' + q];
    return g && (g.unlockCost !== undefined ? g.unlockCost : g.cost);
  },
  dropOddsText() {
    const eligible = (items.GRADES || []).filter(g => g.q === 0 || this.stageNo() >= g.unlockStage);
    const total = eligible.reduce((sum, g) => sum + (items.DROP_QUALITY_WEIGHTS[g.q] || 0), 0);
    const odds = eligible.map(g => g.short + Math.round(100 * items.DROP_QUALITY_WEIGHTS[g.q] / total) + '%').join(' / ');
    return '战役首通掉落率65%；当前品质概率：' + odds + '（未开放品质不计）';
  },
  drawConfirm() {
    const c = this.confirm;
    const box = ui.modal(c.type === 'upgrade' ? '部位升星确认' : '解锁军械确认', 34, Math.max(110, (app.H - 210) / 2), app.W - 68, 210);
    ui.setModalClose(() => { this.confirm = null; });
    if (c.type === 'upgrade') {
      const slot = c.slot, star = starAt(this.armory.slotStars, slot), need = this.starNeed(star), gold = this.starGold(star);
      const item = this.currentItem(slot), iron = this.s.res.iron || 0, coins = this.s.res.gold || 0;
      ui.wrap('升级' + this.slotName(slot) + '位，全体英雄共同受益。当前★' + star + ' → ★' + (star + 1) + '。', box.x, box.y + 2, box.w, 14, { size: 10, color: T.TEXT });
      if (item) {
        ui.text('当前装备：' + item.name, box.x, box.y + 35, { size: 9, color: qualityColor(item.q) });
        ui.text('本次属性提升：' + pctText(upgradeDelta(item.basePct || item.stats)), box.x, box.y + 51, { size: 8, color: T.GOLD_HI });
      }
      ui.text('部位材料：精铁 ×' + (need == null ? '—' : need) + ' · 铜钱 ×' + gold, box.x, box.y + 68, { size: 9, color: T.DIM });
      ui.text('持有：精铁 ' + F.fmtNum(iron) + ' · 铜钱 ' + F.fmtNum(coins), box.x, box.y + 84, { size: 9, color: T.DIM });
      ui.btn(box.x, box.y + 105, 122, 30, { text: '取消', style: 'ghost', size: 11, id: 'armory-confirm-cancel', cb: () => { this.confirm = null; } });
      ui.btn(box.x + 134, box.y + 105, 122, 30, { text: '确认升星', style: 'gold', size: 11, id: 'armory-confirm-upgrade', disabled: need == null || iron < need || coins < gold, cb: () => this.runAction('upgrade', slot) });
    } else {
      const item = this.catalog.find(x => x.id === c.itemId), cost = item && this.unlockCost(item.q);
      ui.wrap(item ? item.name + ' · ' + qualityName(item.q) + ' · 消耗精铁 ×' + cost + '。解锁后可由全军启用。' : '', box.x, box.y + 6, box.w, 15, { size: 10, color: T.TEXT });
      ui.text('当前精铁：' + F.fmtNum(this.s.res.iron || 0), box.x, box.y + 48, { size: 9, color: T.DIM });
      ui.btn(box.x, box.y + 105, 122, 30, { text: '取消', style: 'ghost', size: 11, id: 'armory-unlock-cancel', cb: () => { this.confirm = null; } });
      ui.btn(box.x + 134, box.y + 105, 122, 30, { text: '确认解锁', style: 'gold', size: 11, id: 'armory-unlock-confirm', disabled: !item || this.s.res.iron < cost, cb: () => this.runAction('unlock', item.id) });
    }
  },
  runAction(type, ...args) {
    const calls = { select: store.armorySelect, unlock: store.armoryUnlock, upgrade: store.armoryUpgrade, claimBox: store.armoryClaimBox };
    const fn = calls[type];
    if (typeof fn !== 'function') { ui.toast('军械功能正在接入'); this.confirm = null; return; }
    const result = type === 'select' ? fn(args[0] && this.catalog.find(x => x.id === args[0])?.slot, args[0]) : fn(...args);
    if (!result || !result.ok) { ui.toast(result && result.msg || '操作未完成'); return; }
    this.confirm = null;
    this.refresh();
    if (type === 'select' || type === 'claimBox') {
      const itemId = type === 'select' ? args[0] : args[1];
      if (this.armory.seen) this.armory.seen[itemId] = true;
    }
    ui.toast(result.msg || ({ unlock: '图鉴已解锁', select: '已为全军启用', upgrade: '部位升星成功', claimBox: '军械箱已领取' }[type]));
  }
};
