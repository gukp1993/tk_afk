// 通用武将卡片：传入 calc(经 store.calcHero 计算)或简要展示对象
const C = require('../../utils/config');
const H = require('../../utils/heroes');

Component({
  properties: {
    hero: { type: Object, value: null },     // calcHero 结果
    mode: { type: String, value: 'grid' },   // grid | row | mini
    selected: { type: Boolean, value: false },
    marked: { type: String, value: '' }      // 角标文字，如 "上阵"
  },
  data: {
    factionName: '', className: '', starArr: [0, 0, 0, 0, 0], surname: ''
  },
  observers: {
    hero(v) {
      if (!v) return;
      const def = H.getHero(v.id);
      const fac = C.FACTIONS[v.faction] || {};
      const cls = C.CLASSES[v.cls] || {};
      this.setData({
        factionName: fac.name || '',
        facCls: fac.cls || '',
        facColor: fac.color || '',
        className: cls.name || '',
        classIcon: cls.icon || '',
        starArr: [1, 2, 3, 4, 5].map(i => (i <= (v.star || 0) ? 2 : (i <= (def ? C.RARITIES[def.rarity].maxStar : 5) ? 1 : 0))),
        surname: (v.name || '').slice(0, 1),
        rarityName: def ? C.RARITIES[def.rarity].name : ''
      });
    }
  },
  methods: {
    onTap() {
      this.triggerEvent('cardtap', { hero: this.data.hero });
    }
  }
});
