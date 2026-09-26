// 群英录：武将网格 + 共鸣说明 + 筛选排序
const { app, ui } = require('../app');
const T = require('../theme');
const store = require('../../utils/store');
const F = require('../../utils/fmt');

const FILTERS = [
  { key: 'all', name: '全部' }, { key: 'wei', name: '魏' }, { key: 'shu', name: '蜀' },
  { key: 'wu', name: '吴' }, { key: 'qun', name: '群' }
];
const SORTS = [
  { key: 'power', name: '战力' }, { key: 'level', name: '等级' },
  { key: 'rarity', name: '品质' }, { key: 'star', name: '品阶' }
];

module.exports = {
  name: 'heroes',
  scroll: {}, scrollReg: {},
  filter: 'all', sort: 'power',

  onEnter() {
    store.checkDailyReset();
    this.refresh();
  },
  refresh() {
    const crystal = store.crystalInfo();
    this.crystal = crystal;
    let list = store.allRoster().map(h => ({ ...h, isTop5: crystal.top5.some(t => t.id === h.id) }));
    if (this.filter !== 'all') list = list.filter(h => h.faction === this.filter);
    const keyFn = {
      power: h => h.power,
      level: h => h.level,
      rarity: h => h.rarity * 100000 + h.power,
      star: h => h.star * 100000 + h.power
    }[this.sort];
    this.list = list.slice().sort((a, b) => keyFn(b) - keyFn(a));
  },

  draw() {
    app.resBar(10, ['gold', 'gem', 'scroll', 'exp']);
    let y = 40;

    // 共鸣水镜
    ui.panel(8, y, 359, 52);
    ui.text('共鸣水镜', 20, y + 8, { size: 15, color: T.GOLD_HI, bold: true });
    ui.text('已聚 ' + this.crystal.count + ' 将', 355, y + 11, { size: 10, color: T.DIM, align: 'right' });
    ui.wrap('共鸣等级 Lv.' + this.crystal.cap + ' — 等级前五定下全军共鸣之境，其余武将自动共享此等级。', 20, y + 28, 335, 12, { size: 10 });
    y += 60;

    // 筛选
    let x = 8;
    FILTERS.forEach(f => {
      const w = 40;
      ui.chipBtn(x, y, w, 20, f.name, this.filter === f.key, () => { this.filter = f.key; this.refresh(); }, 'f-' + f.key);
      x += w + 6;
    });
    x += 10;
    SORTS.forEach(so => {
      const w = 52;
      ui.chipBtn(x, y, w, 20, so.name + '↓', this.sort === so.key, () => { this.sort = so.key; this.refresh(); }, 's-' + so.key);
      x += w + 4;
    });
    y += 28;

    // 网格
    const cols = 3, gw = (359 - 2 * 8) / 3, gh = 128;
    const rows = Math.ceil(this.list.length / cols);
    const contentH = rows * (gh + 8);
    ui.beginScroll(this, 'grid', 8, y, 359, app.H - y - 56, contentH);
    this.list.forEach((h, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const gx = 8 + col * (gw + 8);
      const gy = y + row * (gh + 8);
      const maxStar = [0, 2, 3, 4, 5][h.rarity];
      ui.panel(gx, gy, gw, gh, { ornate: h.rarity === 4 });
      ui.tap(gx, gy, gw, gh, () => app.push('heroDetail', { id: h.id }), 'hero-' + h.id);
      ui.heroFace(gx + 5, gy + 5, gw - 10, h, { mark: h.isTop5 ? '共鸣' : null });
      ui.text(h.name, gx + 5, gy + 74, { size: 13, bold: true });
      ui.text(T.RARITY[h.rarity].name, gx + gw - 5, gy + 75, { size: 11, color: T.RARITY[h.rarity].color, bold: true, align: 'right' });
      ui.text(h.title, gx + 5, gy + 90, { size: 9, color: T.DIM });
      ui.stars(gx + 5, gy + 101, maxStar, h.star, 9);
      ui.text('Lv.' + h.level, gx + 5, gy + 114, { size: 10, color: T.GOLD });
      ui.text('战力 ' + F.fmtNum(h.power), gx + gw - 5, gy + 114, { size: 9, color: T.DIM, align: 'right' });
    });
    if (!this.list.length) ui.text('尚无武将，前往点将台招募', 187, y + 60, { size: 12, color: T.DIM, align: 'center' });
    ui.endScroll();
  }
};
