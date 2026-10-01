// @ts-nocheck
// Generated from utils/formation.js by scripts/cocos-sync-domain.js. Do not edit here.
import * as __domain_config from './config';
import * as __domain_heroes from './heroes';
// 确定性均衡编队建议，不修改传入阵容。
// 前排取坦度（坦克/战士按战力），后排取输出（法师/神射按攻击，战士次之，辅助兜底），
// 避免按总战力挑选时凑出五坦克的零输出阵容（输出不足会打满 90 秒超时判负）。
// enemyFaction（研讨会十 F1）：可选敌阵主阵营；传入时优先选克制阵营（wei→shu→wu→qun→wei 环）
// 的人选填充同档位，缺员回落均衡——只改选择顺序，不改任何难度数值。
function recommendFormation(roster, enemyFaction) {
  const all = (roster || []).filter(Boolean).slice();
  // 反查：敌=shu → 找 BEATS[x]='shu' 的 x（wei 克 shu）→ 我方优先选 wei 阵营
  const beats = enemyFaction ? (Object.keys(__domain_config.BEATS || {}).find(k => (__domain_config.BEATS || {})[k] === enemyFaction) || null) : null;
  // 克制优先比较器：注入后续各排序，克制阵营在同战力时前移
  const factionPriority = beats ? (h) => (h.faction === beats ? -1 : 0) : () => 0;
  if (!all.length) return [null, null, null, null, null];
  const powerOrder = (a, b) => (factionPriority(a) - factionPriority(b)) || (Number(b.power) || 0) - (Number(a.power) || 0) || String(a.id).localeCompare(String(b.id));
  const atkOf = h => (Number(h.stats && h.stats.atk) || 0);
  const backRank = h => (h.cls === 'mage' || h.cls === 'archer' ? 0 : h.cls === 'support' ? 2 : 1);
  const backOrder = (a, b) => (factionPriority(a) - factionPriority(b)) || backRank(a) - backRank(b) || atkOf(b) - atkOf(a) || powerOrder(a, b);

  // 前排：坦克/战士按战力取前三
  const front = all.filter(h => h.cls === 'tank' || h.cls === 'warrior').sort(powerOrder).slice(0, 3);
  const usedIds = new Set(front.map(h => h.id));
  const rest = all.filter(h => !usedIds.has(h.id)).sort(powerOrder);
  // 后排：优先远程输出位（按攻击），不足两名时用剩余高战力补
  const back = rest.slice().sort(backOrder).slice(0, 2);
  rest.forEach(h => {
    if (front.length < 3 && !front.some(x => x.id === h.id) && !back.some(x => x.id === h.id)) front.push(h);
  });
  rest.forEach(h => {
    if (back.length < 2 && !front.some(x => x.id === h.id) && !back.some(x => x.id === h.id)) back.push(h);
  });
  const ids = front.slice(0, 3).concat(back.slice(0, 2)).map(h => h ? h.id : null);
  while (ids.length < 5) ids.push(null);
  return ids;
}
// 阵型模板校验：5 槽、查重、查未拥有、查英雄表外幽灵 id（防 teamPower 崩溃）、至少 1 人
function validatePreset(slots, rosterIds) {
  const owned = new Set(rosterIds || []);
  if (!Array.isArray(slots) || slots.length !== 5) return { ok: false, msg: '阵容数据无效' };
  const used = slots.filter(Boolean);
  if (used.some(id => !owned.has(id))) return { ok: false, msg: '含未拥有武将' };
  if (new Set(used).size !== used.length) return { ok: false, msg: '武将重复' };
  if (used.length < 1) return { ok: false, msg: '至少上阵 1 人' };
  const H2 = __domain_heroes;
  if (used.some(id => !H2.getHero(id))) return { ok: false, msg: '含无效武将' };
  return { ok: true };
}
export { recommendFormation, validatePreset };
