const assert = require('assert');
const { recommendFormation } = require('../utils/formation');
const roster = [
  { id: 'tank1', cls: 'tank', power: 100, stats: { hp: 500, def: 20 } },
  { id: 'warrior1', cls: 'warrior', power: 90, stats: { hp: 400, def: 15 } },
  { id: 'support1', cls: 'support', power: 200, stats: { hp: 300, def: 10 } },
  { id: 'mage1', cls: 'mage', power: 180, stats: { hp: 280, def: 8 } },
  { id: 'archer1', cls: 'archer', power: 170, stats: { hp: 260, def: 7 } },
  { id: 'tank2', cls: 'tank', power: 80, stats: { hp: 450, def: 18 } }
];
const first = recommendFormation(roster);
assert.deepStrictEqual(first, ['tank1', 'warrior1', 'mage1', 'support1', 'archer1']);
assert.deepStrictEqual(recommendFormation(roster), first, 'recommendation is deterministic');
assert.strictEqual(new Set(first).size, 5, 'each hero appears once');
assert.deepStrictEqual(recommendFormation([roster[0], roster[2]]), ['tank1', 'support1', null, null, null]);
assert.deepStrictEqual(recommendFormation([]), [null, null, null, null, null]);
console.log('formation: 5/5 passed');
