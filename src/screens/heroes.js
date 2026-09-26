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
    ui.text('英雄 · 群英录', 12, 44, { size: 20, color: T.GOLD_HI, bold: true });
    ui.text('点击英雄，查看技能、升级与装备', 12, 70, { size: 11, color: T.DIM });
    ui.btn(269, 43, 94, 34, {
      text: '调整编队', style: 'gold', size: 12, id: 'heroes-formation', cb: () => app.push('formation')
    });
    let y = 92;

    // 共鸣水镜
    ui.panel(8, y, 359, 56);
    ui.text('共鸣水镜', 20, y + 8, { size: 15, color: T.GOLD_HI, bold: true });
    ui.text('已聚 ' + this.crystal.count + ' 将', 355, y + 11, { size: 10, color: T.DIM, align: 'right' });
    ui.wrap('共鸣 Lv.' + this.crystal.cap + ' · 等级最高的五将决定共鸣等级，其余英雄受自身星级上限限制。', 20, y + 28, 335, 12, { size: 10 });
    y += 64;

    // 阵营与排序分成两行，375 逻辑宽度下完整可见。
    ui.text('阵营', 12, y + 6, { size: 11, color: T.DIM });
    FILTERS.forEach((f, i) => {
      ui.chipBtn(52 + i * 63, y, 59, 26, f.name, this.filter === f.key, () => {
        this.filter = f.key; this.scroll.grid = 0; this.refresh();
      }, 'f-' + f.key);
    });
    y += 32;
    ui.text('排序', 12, y + 6, { size: 11, color: T.DIM });
    SORTS.forEach((so, i) => {
      ui.chipBtn(52 + i * 79, y, 74, 26, so.name + '↓', this.sort === so.key, () => {
        this.sort = so.key; this.scroll.grid = 0; this.refresh();
      }, 's-' + so.key);
    });
    y += 34;

    // 网格
    const cols = 3, gw = (359 - 2 * 8) / 3, gh = 157;
    const rows = Math.ceil(this.list.length / cols);
    const contentH = Math.max(136, rows * (gh + 8));
    ui.beginScroll(this, 'grid', 8, y, 359, app.H - y - 56, contentH);
    this.list.forEach((h, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const gx = 8 + col * (gw + 8);
      const gy = y + row * (gh + 8);
      const maxStar = [0, 2, 3, 4, 5][h.rarity];
      ui.panel(gx, gy, gw, gh, { ornate: h.rarity === 4 });
      ui.tap(gx, gy, gw, gh, () => app.push('heroDetail', { id: h.id }), 'hero-' + h.id);
      ui.heroFace(gx + (gw - 74) / 2, gy + 8, 74, h, { mark: h.isTop5 ? '共鸣' : null });
      ui.text(h.name, gx + 5, gy + 89, { size: 13, bold: true });
      ui.text(T.RARITY[h.rarity].name, gx + gw - 5, gy + 90, { size: 11, color: T.RARITY[h.rarity].color, bold: true, align: 'right' });
      ui.text(h.title, gx + 5, gy + 108, { size: 9, color: T.DIM });
      ui.stars(gx + 5, gy + 122, maxStar, h.star, 9);
      ui.text('Lv.' + h.level, gx + 5, gy + 139, { size: 10, color: T.GOLD });
      ui.text('战力 ' + F.fmtNum(h.power), gx + gw - 5, gy + 139, { size: 9, color: T.DIM, align: 'right' });
    });
    if (!this.list.length) {
      ui.text(this.filter === 'all' ? '还没有英雄，先去召唤一位吧' : '还未拥有这个阵营的英雄', 187, y + 28, { size: 12, color: T.DIM, align: 'center' });
      ui.btn(127, y + 58, 120, 36, { text: '前往召唤', style: 'gold', size: 13, id: 'heroes-summon', cb: () => app.switchTab('summon') });
    }
    ui.endScroll();
  }
};
