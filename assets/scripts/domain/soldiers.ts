// @ts-nocheck
// Generated from utils/soldiers.js by scripts/cocos-sync-domain.js. Do not edit here.
import * as __domain_heroes from './heroes';
// 小兵单位（2026-10-01 用户指令：核心关配剧情人物，杂关可附带小兵）
// 十二种剧情小兵按章主题映射；数值为同级英雄的 5~6 成，给「群感」不给难度。
// 纯数据+构造，不落存档；敌阵第 5 槽（后排末位）按规则替换，核心关（名将/精锐/词缀）不替换。
const TYPES = {
  huangjin: { name: '黄巾兵', faction: 'qun', cls: 'warrior', mult: { hp: 0.62, atk: 0.58, def: 0.5 }, ult: { name: '乱刀', desc: '挥舞柴刀乱砍', effects: [{ t: 'dmg', tgt: 'single', mult: 1.3 }] } },
  huangjin2: { name: '黄巾小校', faction: 'qun', cls: 'warrior', mult: { hp: 0.72, atk: 0.66, def: 0.58 }, ult: { name: '妖言惑众', desc: '咒骂使我方迟疑', effects: [{ t: 'debuff', tgt: 'single', stat: 'atk', pct: 0.1, dur: 4 }] } },
  xiliang: { name: '西凉兵', faction: 'qun', cls: 'warrior', mult: { hp: 0.7, atk: 0.68, def: 0.6 }, ult: { name: '骑撞', desc: '纵马冲撞', effects: [{ t: 'dmg', tgt: 'single', mult: 1.4 }] } },
  shanzei: { name: '山贼刀兵', faction: 'qun', cls: 'warrior', mult: { hp: 0.6, atk: 0.62, def: 0.5 }, ult: { name: '劈砍', desc: '大开大阖的劈砍', effects: [{ t: 'dmg', tgt: 'single', mult: 1.35 }] } },
  shanzei2: { name: '山贼弓手', faction: 'qun', cls: 'archer', mult: { hp: 0.52, atk: 0.7, def: 0.42 }, ult: { name: '冷箭', desc: '瞄准破绽放冷箭', effects: [{ t: 'dmg', tgt: 'single', mult: 1.5 }] } },
  yuanjun: { name: '冀州枪兵', faction: 'qun', cls: 'warrior', mult: { hp: 0.66, atk: 0.64, def: 0.6 }, ult: { name: '连突', desc: '长枪连突两下', effects: [{ t: 'dmg', tgt: 'single', mult: 0.8, hits: 2 }] } },
  jizhou: { name: '冀州弓手', faction: 'qun', cls: 'archer', mult: { hp: 0.54, atk: 0.72, def: 0.44 }, ult: { name: '覆射', desc: '抛射箭雨', effects: [{ t: 'dmg', tgt: 'single', mult: 1.45 }] } },
  jingzhou: { name: '荆州水兵', faction: 'wu', cls: 'warrior', mult: { hp: 0.64, atk: 0.6, def: 0.55 }, ult: { name: '钩拒', desc: '钩拒勾拉', effects: [{ t: 'dmg', tgt: 'single', mult: 1.3 }] } },
  baier: { name: '白毦兵', faction: 'shu', cls: 'warrior', mult: { hp: 0.74, atk: 0.68, def: 0.64 }, ult: { name: '结阵', desc: '白毦结阵自守', effects: [{ t: 'shield', tgt: 'self', mult: 1.6 }] } },
  manbing: { name: '南蛮兵', faction: 'qun', cls: 'warrior', mult: { hp: 0.7, atk: 0.7, def: 0.5 }, ult: { name: '掷矛', desc: '重掷蛮矛', effects: [{ t: 'dmg', tgt: 'single', mult: 1.45 }] } },
  weiwu: { name: '魏武卫', faction: 'wei', cls: 'warrior', mult: { hp: 0.72, atk: 0.66, def: 0.66 }, ult: { name: '坚盾', desc: '武卫结盾推进', effects: [{ t: 'shield', tgt: 'self', mult: 1.5 }] } },
  jingdie: { name: '精锐家兵', faction: 'qun', cls: 'warrior', mult: { hp: 0.85, atk: 0.78, def: 0.7 }, ult: { name: '死士突袭', desc: '家兵死士齐突', effects: [{ t: 'dmg', tgt: 'single', mult: 1.55 }] } }
};

// 章主题 → 小兵类型（16 章循环复用）
const CHAPTER_TROOP = {
  1: 'huangjin', 2: 'xiliang', 3: 'shanzei', 4: 'yuanjun', 5: 'shanzei2', 6: 'jingzhou',
  7: 'jingzhou', 8: 'weiwu', 9: 'jingzhou', 10: 'jingzhou', 11: 'manbing', 12: 'weiwu',
  13: 'weiwu', 14: 'jingdie', 15: 'jingdie', 16: 'jingdie'
};

// 基准体魄：借最弱 N 将的同级白板体魄 × 兵种系数（与英雄尺度对齐）
function makeSoldier(typeId, level, elite) {
  const H = __domain_heroes;
  const def = TYPES[typeId] || TYPES.huangjin;
  const anchor = H.getHero('mengda');
  const base = H.heroStatsStar(anchor, Math.max(1, level), 0);
  const m = elite ? 1.3 : 1;
  return {
    soldier: true,
    id: 'soldier_' + typeId,
    name: def.name,
    faction: def.faction,
    cls: def.cls,
    level: Math.max(1, level),
    star: elite ? 1 : 0,
    stats: {
      hp: Math.floor(base.hp * def.mult.hp * m),
      atk: Math.floor(base.atk * def.mult.atk * m),
      def: Math.floor(base.def * def.mult.def * m),
      spd: base.spd,
      crit: 0.02
    },
    ult: def.ult,
    passive: {},
    isBoss: false,
    row: 1
  };
}
function troopOfChapter(chIdx) {
  return CHAPTER_TROOP[((chIdx - 1) % 16) + 1] || 'huangjin';
}
export { TYPES, CHAPTER_TROOP, makeSoldier, troopOfChapter };
