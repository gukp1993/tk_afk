// 战役章节与群英塔（敌方阵容生成）
// 前 12 章 × 10 关走 utils/story.js 演义剧情表（名称/敌阵/对白/名将关）；
// 超出剧情表的关卡进入循环乱世，用由 story 派生的兜底章节轮转生成（单一数据源，不维护第二份敌将表）。
const { getHero } = require('./heroes');
const { FIRST_STAGE_END, CAMPAIGN_DIFFICULTY } = require('./config');
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
  const progress = Math.min(1, Math.max(0, (globalStage - 1) / (FIRST_STAGE_END - 1)));
  return 1 + (CAMPAIGN_DIFFICULTY.normalEndScale - 1) * progress;
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
  const bossScale = CAMPAIGN_DIFFICULTY.bossOverrides[globalStage];
  const normalScale = stageScale(globalStage) * (CAMPAIGN_DIFFICULTY.normalOverrides[globalStage] || 1);
  const lv = Math.max(1, Math.round(1 + (globalStage - 1) * CAMPAIGN_DIFFICULTY.levelSlope));
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
      scale: isBoss
        ? (i === 0 ? (bossScale ? bossScale.main : CAMPAIGN_DIFFICULTY.bossMainScale)
          : (bossScale ? bossScale.other : CAMPAIGN_DIFFICULTY.bossOtherScale))
        : normalScale * (i === 0 ? 1 : 0.92),
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
  const scale = 1;
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

// 无次数限制的练兵队：三名低稀有度武将，敌方弱于同等级常规守军。
function makePracticeEnemies(playerLevel, seed) {
  const H = require('./heroes');
  const ids = ['liaohua', 'mengda', 'masu'];
  const lv = Math.max(1, Math.floor(playerLevel || 1) - 2);
  const units = ids.map((id, i) => ({
    hero: H.getHero(id), level: lv, star: 0,
    scale: 0.6, isBoss: false, row: i < 2 ? 0 : 1
  }));
  return { name: '练兵场 · 熟悉阵容', units, isBoss: false, seed: seed || 1, referenceLevel: lv };
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

module.exports = { CHAPTERS, STAGES_PER_CH, stageScale, chapterOf, makeStageEnemies, makeTowerEnemies, makeArenaEnemies, makePracticeEnemies };
