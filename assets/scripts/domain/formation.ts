// @ts-nocheck
// Generated from utils/formation.js by scripts/cocos-sync-domain.js. Do not edit here.

// 确定性均衡编队建议，不修改传入阵容。
function recommendFormation(roster) {
  const all = (roster || []).filter(Boolean).slice();
  const powerOrder = (a, b) => (Number(b.power) || 0) - (Number(a.power) || 0) || String(a.id).localeCompare(String(b.id));
  const allByPower = all.slice().sort(powerOrder);
  const tanks = all.filter(h => h.cls === 'tank').sort(powerOrder);
  const fighters = all.filter(h => h.cls === 'warrior').sort(powerOrder);
  const firstFront = tanks[0] || fighters[0] || allByPower[0];
  if (!firstFront) return [null, null, null, null, null];
  const chosen = [firstFront];
  const supports = all.filter(h => h.id !== firstFront.id && h.cls === 'support').sort(powerOrder);
  if (supports.length) chosen.push(supports[0]);
  allByPower.forEach(h => { if (chosen.length < 5 && !chosen.some(x => x.id === h.id)) chosen.push(h); });

  const front = chosen.filter(h => h.cls === 'tank' || h.cls === 'warrior').sort((a, b) => {
    const role = (h) => h.cls === 'tank' ? 0 : 1;
    return role(a) - role(b) || powerOrder(a, b);
  }).slice(0, 3);
  const remaining = chosen.filter(h => !front.some(x => x.id === h.id));
  const bulk = remaining.filter(h => h.cls !== 'support').sort((a, b) =>
    (Number(b.stats && b.stats.hp) || 0) - (Number(a.stats && a.stats.hp) || 0) ||
    (Number(b.stats && b.stats.def) || 0) - (Number(a.stats && a.stats.def) || 0) || powerOrder(a, b));
  while (front.length < 3 && bulk.length) front.push(bulk.shift());
  const back = chosen.filter(h => !front.some(x => x.id === h.id)).sort((a, b) => {
    const support = (h) => h.cls === 'support' ? 0 : 1;
    return support(a) - support(b) || powerOrder(a, b);
  });
  // 只有非辅助不足三名时，剩余成员才会补前排。
  while (front.length < 3 && back.length) front.push(back.shift());
  while (back.length < 2 && chosen.some(h => !front.some(x => x.id === h.id) && !back.some(x => x.id === h.id))) {
    const next = chosen.find(h => !front.some(x => x.id === h.id) && !back.some(x => x.id === h.id));
    if (!next) break;
    back.push(next);
  }
  const ids = front.slice(0, 3).concat(back.slice(0, 2)).map(h => h ? h.id : null);
  while (ids.length < 5) ids.push(null);
  return ids;
}
export { recommendFormation };
