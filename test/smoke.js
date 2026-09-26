// 核心逻辑冒烟测试（node test/smoke.js）
const store = require('../utils/store');
const battle = require('../utils/battle');
const stages = require('../utils/stages');
const heroes = require('../utils/heroes');

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; }
  else { fail++; console.log('FAIL: ' + name); }
}

// 1. 数据完整性
heroes.HEROES.forEach(h => {
  ok(h.base && h.base.hp > 0 && h.ult && h.ult.effects && h.ult.effects.length, 'hero kit: ' + h.id);
  ok(h.passive && h.passive.name, 'hero passive: ' + h.id);
});

// 2. 存档与初始阵容
store.load();
const roster = store.allRoster();
ok(roster.length >= 4, 'starters exist');
const units = store.playerUnits();
ok(units.length >= 3, 'player units built, got ' + units.length);
const enemy = stages.makeStageEnemies(1);
const eUnits = store.enemyUnits(enemy.units);
ok(eUnits.length === 5, 'enemy units built');

// 3. 战斗可跑完
let b = battle.createBattle({ team: units, enemy: eUnits, seed: 42 });
let guard = 0, res = null, eventsSeen = 0;
while (!b.ended && guard < 3000) {
  const r = b.step(0.1);
  eventsSeen += r.events.length;
  guard++;
  if (r.done) { res = b.result(); break; }
}
ok(b.ended, 'battle finishes (guard=' + guard + ', events=' + eventsSeen + ')');
ok(res && (res.winner === 'A' || res.winner === 'B'), 'battle has winner');

// 4. 弱方必败
const weakTeam = units.slice(0, 1);
let b2 = battle.createBattle({ team: weakTeam, enemy: eUnits, seed: 7 });
let g2 = 0;
while (!b2.ended && g2 < 2000) { b2.step(0.1); g2++; }
ok(b2.result().winner === 'B', '1v5 loses');

// 5. 高等级碾压
const strongUnits = store.playerUnits().map(u => {
  const s = Object.assign({}, u);
  s.stats = { hp: u.stats.hp * 50, atk: u.stats.atk * 50, def: u.stats.def * 50, spd: u.stats.spd, crit: u.stats.crit };
  return s;
});
let b3 = battle.createBattle({ team: strongUnits, enemy: eUnits, seed: 9 });
let g3 = 0;
while (!b3.ended && g3 < 2000) { b3.step(0.1); g3++; }
ok(b3.result().winner === 'A', 'overpower wins, took ' + g3 + ' ticks');

// 6. 招募与保底
store.getState().res.gem = 288000;
let sawSSR = false;
for (let i = 0; i < 30; i++) {
  const r = store.doSummon('gem10');
  ok(r.ok, 'summon ok ' + i);
  if (r.results.some(x => x.rarity === 3)) sawSSR = true;
}
ok(sawSSR, 'gacha yields SSR eventually');
ok(store.getState().summon.total === 300, 'summon counted');

// 7. 升级/升阶/遣散
const s0 = store.getState();
s0.res.gold = 5e9; s0.res.exp = 5e9;
const someId = Object.keys(s0.roster)[0];
const lv0 = s0.roster[someId].lv;
store.levelUp(someId, 50);
ok(s0.roster[someId].lv > lv0, 'level up works: ' + lv0 + '->' + s0.roster[someId].lv);
ok(s0.roster[someId].lv <= 60, 'level cap respected: ' + s0.roster[someId].lv);

// 8. 挂机
s0.idle.last = Date.now() - 3 * 3600 * 1000;
s0.idle.gold = 0; s0.idle.exp = 0; s0.idle.scroll = 0;
store.idleTick();
const pend = store.idlePending();
ok(pend.gold > 0 && pend.hours <= 12.02, 'idle accrual: ' + JSON.stringify(pend.hours));
const claim = store.claimIdle();
ok(claim.gold > 0, 'idle claim: ' + claim.gold);

// 9. 装备
const eid = store.addEquip(3, 'weapon');
const before = JSON.stringify(store.calcHero(someId).stats);
store.equipTo(someId, 'weapon', eid);
const after = store.calcHero(someId).stats;
ok(after.atk > JSON.parse(before).atk, 'equip boosts atk');
const enh = store.enhanceEquip(eid);
ok(enh.ok, 'enhance works');

// 10. 升阶（给同名卡+兵魂）
s0.roster[someId].cards = 5;
s0.res.gold = 1e8;
const st0 = s0.roster[someId].star;
const asc = store.ascend(someId);
ok(asc.ok, 'ascend ok: ' + JSON.stringify(asc));

// 11. 塔/演武/任务/商店
const tr = store.winTower(1);
ok(tr.gem > 0, 'tower reward');
const af = store.arenaFight(true, 1.0);
ok(af.tokens === 2, 'arena tokens');
const ql = store.questList();
ok(ql.every(q => typeof q.done === 'boolean'), 'quest list ok');
s0.res.gem = 100000;
const buy = store.buyGood('s_gold');
ok(buy.ok, 'shop buy ok');

// 12. 演武对手生成
const opp = stages.makeArenaEnemies(store.teamPower(), 123, 1.0);
ok(opp.units.length === 5, 'arena enemies ok');
const tw = stages.makeTowerEnemies(3);
ok(tw.units.length === 5, 'tower enemies ok');

// 13. 广告：每日计数、双倍领取、免费快速收获、复活血量
ok(store.adCount('fast') === 0, 'ad count init');
store.adBump('fast'); store.adBump('fast');
ok(store.adCount('fast') === 2, 'ad bump works');
s0.idle.gold = 500; s0.idle.exp = 400; s0.idle.scroll = 0; s0.idle.last = Date.now();
const c2 = store.claimIdle(true);
ok(c2.gold === 1000 && c2.exp === 800, 'claimIdle double: ' + JSON.stringify(c2));
const gemBefore = s0.res.gem;
const frf = store.fastReward(true);
ok(frf.ok && s0.res.gem === gemBefore, 'free fast reward skips gem');
const frp = store.fastReward(false);
ok(frp.ok && s0.res.gem === gemBefore - 50, 'paid fast reward costs gem');
// 复活：startHpPct 生效
const strongP = store.playerUnits();
const b4 = battle.createBattle({
  team: strongP.map(u => Object.assign({}, u, { startHpPct: 0.3 })),
  enemy: eUnits, seed: 5
});
const snapPct = b4.snapshot().filter(s => s.side === 'A');
ok(snapPct.every(s => s.hp <= s.maxHp * 0.3 + 1), 'revive startHpPct applied: ' + JSON.stringify(snapPct.map(s => s.hp + '/' + s.maxHp)));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
