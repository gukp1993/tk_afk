// 战役章节与群英塔（敌方阵容生成）
// 前 12 章 × 10 关走 utils/story.js 演义剧情表（名称/敌阵/对白/名将关）；
// 超出剧情表的关卡进入循环乱世，用由 story 派生的兜底章节轮转生成（单一数据源，不维护第二份敌将表）。
const { getHero } = require('./heroes');
const story = require('./story');
const F = require('./fmt');

const STAGES_PER_CH = 10;

// 循环乱世兜底章节：名字/主将/敌阵取自剧情表（首关敌阵作轮转池）
const CHAPTERS = story.CHAPTERS.map(sc => ({
  name: sc.name,
  boss: sc.stages[STAGES_PER_CH - 1].foes[0],
  foes: sc.stages[0].foes
}));

// 敌方强度：全局关卡序号（从 1 开始）
function stageScale(globalStage) {
  return Math.pow(1.05, globalStage - 1);
}
function chapterOf(globalStage) {
  const idx = Math.floor((globalStage - 1) / STAGES_PER_CH); // 0-based
  const inCh = (globalStage - 1) % STAGES_PER_CH;
  const ch = idx < CHAPTERS.length ? CHAPTERS[idx] : CHAPTERS[CHAPTERS.length - 1];
  const loop = idx >= CHAPTERS.length ? idx - CHAPTERS.length + 1 : 0;
  const name = idx < CHAPTERS.length
    ? '第' + F.cnNum(idx + 1) + '章 · ' + ch.name
    : '乱世纷争 · ' + F.cnNum(loop + 1);
  return { ch, idx, inCh, name, isBoss: inCh === STAGES_PER_CH - 1 };
}

// 生成敌方阵容（5 人，slot 0-2 前排，3-4 后排）；剧情表内关卡附带 story 配置
function makeStageEnemies(globalStage) {
  const { ch, inCh, name, isBoss } = chapterOf(globalStage);
  const st = story.getStoryStage(globalStage);
  const scale = stageScale(globalStage) * (isBoss ? 1.25 : 1);
  const lv = Math.max(1, Math.round(1 + (globalStage - 1) * 1.6));
  const pick = (i) => {
    if (st) return st.stage.foes[i];
    if (isBoss && i === 0) return ch.boss;
    return ch.foes[(inCh + i) % ch.foes.length];
  };
  const units = [];
  for (let i = 0; i < 5; i++) {
    const h = getHero(pick(i));
    units.push({
      hero: h,
      level: lv,
      star: Math.min(2, Math.floor((globalStage - 1) / 40)),
      scale: i === 0 && isBoss ? scale : scale * 0.92,
      isBoss: i === 0 && isBoss,
      row: i <= 2 ? 0 : 1
    });
  }
  const label = st ? ' · ' + st.stage.name : (isBoss ? ' · 名将' : ' · 第' + (inCh + 1) + '关');
  return { name: name + label, units, isBoss, story: st };
}

// 群英塔：无限层，随机阵营混合，每 5 层一名将
function makeTowerEnemies(floor) {
  const heroes = require('./heroes').HEROES;
  const rng = require('./rng').makeRng(9000 + floor * 131);
  const pool = rng.shuffle(heroes.map(h => h.id));
  const scale = Math.pow(1.075, floor - 1);
  const lv = Math.max(1, Math.round(2 + (floor - 1) * 1.8));
  const units = [];
  for (let i = 0; i < 5; i++) {
    const h = require('./heroes').getHero(pool[i]);
    const isBoss = floor % 5 === 0 && i === 0;
    units.push({
      hero: h, level: lv, star: Math.min(3, Math.floor(floor / 25)),
      scale: (isBoss ? scale * 1.2 : scale * 0.9), isBoss, row: i <= 2 ? 0 : 1
    });
  }
  return { name: '群英塔 · 第' + floor + '层', units, isBoss: floor % 5 === 0 };
}

// 演武场对手：按玩家战力缩放
function makeArenaEnemies(playerPower, seed, diff) {
  const heroes = require('./heroes').HEROES;
  const rng = require('./rng').makeRng(seed);
  const pool = rng.shuffle(heroes.map(h => h.id)).slice(0, 5);
  // 由目标战力反推等级
  const targetPower = playerPower * diff;
  const lv = Math.max(1, Math.round(Math.pow(targetPower / 2600, 1 / 1.35)));
  const units = pool.map((hid, i) => {
    const h = require('./heroes').getHero(hid);
    return { hero: h, level: lv, star: Math.min(2, Math.floor(lv / 60)), scale: 1, isBoss: false, row: i <= 2 ? 0 : 1 };
  });
  return { name: '演武场 · 对阵', units, isBoss: false };
}

module.exports = { CHAPTERS, STAGES_PER_CH, stageScale, chapterOf, makeStageEnemies, makeTowerEnemies, makeArenaEnemies };
