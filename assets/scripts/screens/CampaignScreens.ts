import { palette } from '../ui/CocosUi';
import { Page, ScreenContext } from './ScreenContext';
import * as store from '../domain/store';
import * as stages from '../domain/stages';
import * as heroes from '../domain/heroes';
import * as items from '../domain/items';
import * as config from '../domain/config';
import * as fmt from '../domain/fmt';

export function campaign(ctx: ScreenContext) {
  const s = store.getState(), stage = s.campaign.cleared + 1;
  const chapter = stages.chapterOf(stage), enemy = stages.makeStageEnemies(stage);
  const reward = store.campaignRewardPreview(stage), U = ctx.ui;
  ctx.title('三国战役', `${chapter.name} · ${chapter.inCh + 1}/10关`);
  U.rect('CampaignMap', 0, 121, 700, 590, palette.greenLight);
  U.line('River', [[-342,315],[-210,245],[-245,115],[-85,35],[100,-45],[140,-156]], 48, palette.green);
  const points: Array<[number,number]> = [[-235,-119],[70,-20],[-35,80],[115,196],[-30,325]];
  U.line('Road', points, 27, palette.paper);
  const segmentStart = chapter.idx * stages.STAGES_PER_CH + 1 + (chapter.inCh < 5 ? 0 : 5);
  points.forEach(([x,y], i) => {
    const n = segmentStart+i;
    U.button('StageFlag'+i, String(n), x, y, 53, 58, () => {
      if (n === stage) ctx.go('stagePreview');
      else { ctx.notice = `第 ${n} 关 · ${n < stage ? '已通关' : '尚未解锁'}`; ctx.show('campaign'); }
    }, n === stage ? palette.red : n < stage ? palette.paperDark : palette.green);
  });
  const shortcuts: [Page,string][] = [['quests','任务'],['summon','召唤'],['bag','背包'],['armory','军械']];
  shortcuts.forEach(([page,label], i) => U.button('Map'+page,label,277,290-i*105,105,75,()=>ctx.go(page),palette.paperDark));

  U.rect('Camp',0,-239,690,107,palette.green);
  const formation = s.formation.map((id: string|null)=>id ? heroes.getHero(id)?.name || '空' : '空');
  formation.forEach((name: string,i: number)=>U.text('CampHero'+i,name,-260+i*126,-222,118,21,palette.paper));
  U.button('CampEdit','调整编队',274,-266,132,45,()=>ctx.go('formation'),palette.gold);

  U.rect('CampaignInfo', 0, -378, 690, 155, palette.paper);
  U.text('EnemyNames', `第 ${stage} 关 · ${enemy.units.map((u: any) => u.hero.name).join(' ')}`, 0, -329, 660, 20, palette.ink);
  U.text('Rewards', `首通  铜 ${fmt.fmtNum(reward.gold)} · 元宝 ${reward.gem} · 招募令 ${reward.scroll}`, 0, -377, 660, 19, palette.ink);
  const idle = store.idlePending();
  U.text('Idle', `挂机累计  铜 ${fmt.fmtNum(idle.gold)} · 铁 ${idle.iron} · ${idle.hours.toFixed(1)}/${config.IDLE_CAP_HOURS}小时`, 0, -423, 660, 18, palette.ink);
  U.button('Challenge', '挑战', -230, -509, 200, 64, () => ctx.startBattle('campaign',stage), palette.red);
  U.button('Auto', ctx.auto ? '本场后停止' : '自动出征', 0, -509, 216, 64,
    () => ctx.auto ? ctx.stopAuto(true) : ctx.startAuto('campaign'), palette.green);
  U.button('ClaimIdle', '领取挂机', 232, -509, 200, 64, () => ctx.idleClaimChoice(), palette.gold);
}

export function stagePreview(ctx: ScreenContext) {
  const stage=store.getState().campaign.cleared+1;
  const enemy=stages.makeStageEnemies(stage), reward=store.campaignRewardPreview(stage);
  const gain=Math.max(0,config.idleRates(stage).gold-config.idleRates(stage-1).gold);
  ctx.title(`第 ${stage} 关`,enemy.name || '两军对阵');
  ctx.ui.rect('StagePreviewPanel',0,40,650,730,palette.paper);
  ctx.ui.text('StageEnemyTitle','敌方阵容',0,326,590,30,palette.ink);
  enemy.units.forEach((unit: any,i: number)=>ctx.ui.text('StageEnemy'+i,
    `${unit.hero.name} · Lv.${unit.level}`,-197+(i%3)*197,248-Math.floor(i/3)*78,185,22,palette.ink));
  ctx.ui.text('StageRewards',`首通：铜钱 ${fmt.fmtNum(reward.gold)} · 元宝 ${reward.gem} · 招募令 ${reward.scroll}`,
    0,23,600,21,palette.ink);
  ctx.ui.text('StageArmory',reward.armoryBox?'里程碑：军械自选箱 ×1':'首通有 65% 概率获得随机军械',
    0,-54,600,22,palette.ink);
  ctx.ui.text('StageIdle',`通关后挂机铜钱/时 +${fmt.fmtNum(gain)}`,
    0,-116,600,22,palette.ink);
  ctx.ui.button('StageManual','手动挑战',-162,-273,285,86,()=>ctx.startBattle('campaign',stage),palette.red);
  ctx.ui.button('StageAuto','自动出征',162,-273,285,86,()=>ctx.startAuto('campaign'),palette.green);
  ctx.ui.button('StagePreviewBack','返回战役',0,-391,300,65,()=>ctx.go('campaign'),palette.paperDark);
}

export function home(ctx: ScreenContext) {
    const s = store.getState(); ctx.title('主城', `战役 ${s.campaign.cleared} 关 · ${Object.keys(s.roster).length} 名武将`);
    ctx.ui.rect('City', 0, 45, 670, 730, palette.green);
    ctx.ui.text('CityBuildings', '汉宫 · 点将台 · 校场 · 军械坊', 0, 270, 630, 32, palette.paper);
    const links: [Page,string][] = [['summon','点将台'],['formation','编队'],['armory','共享军械'],['shop','集市']];
    links.forEach(([page,text],i) => ctx.ui.button('City'+page,text,i%2?178:-178,75-Math.floor(i/2)*140,300,100,()=>ctx.go(page),palette.paperDark));
    ctx.ui.button('Daily','每日军令',-172,-342,305,83,()=>ctx.go('quests'),palette.gold);
    ctx.ui.button('Fast',`快速收获 ${config.FAST_REWARD_COST}元宝`,172,-342,305,83,()=>ctx.confirm('快速收获',`消耗 ${config.FAST_REWARD_COST} 元宝，立即获得两小时收益`,()=>ctx.tell(store.fastReward(false),'快速收获完成')),palette.red);
    ctx.ui.button('FastAd','广告免费快速收获',0,-441,410,67,()=>ctx.playAd('fast',()=>ctx.tell(store.fastReward(true),'免费快速收获完成')),palette.paperDark);
  }

export function journey(ctx: ScreenContext) {
    const s = store.getState(); ctx.title('玩法','战役 · 群英塔 · 演武场');
    ctx.ui.button('TowerLink',`群英塔  已过 ${s.tower.best} 层`,0,270,580,130,()=>ctx.go('tower'),palette.green);
    ctx.ui.button('ArenaLink',`演武场  ${s.arena.points} 积分`,0,70,580,130,()=>ctx.go('arena'),palette.green);
    ctx.ui.button('CampaignLink',`主线  已过 ${s.campaign.cleared} 关`,0,-130,580,130,()=>ctx.go('campaign'),palette.green);
    ctx.ui.button('TrainingLink','自动练兵 · 最多10胜',0,-320,580,105,()=>ctx.startAuto('training'),palette.paperDark);
  }

export function bag(ctx: ScreenContext) {
    const s=store.getState(), idle=store.idlePending(); ctx.title('背包与资源','资源、挂机收益、免费军令');
    [['铜钱',s.res.gold],['元宝',s.res.gem],['招募令',s.res.scroll],['演武令',s.res.token],['英雄碎片',s.res.shard],['精铁',s.res.iron]].forEach(([name,n],i)=>ctx.row('Bag'+i,`${name}    ${fmt.fmtNum(n)}`,355-i*100));
    ctx.ui.text('IdleBag',`待领挂机  铜 ${fmt.fmtNum(idle.gold)} · 铁 ${idle.iron} · 令 ${idle.scroll}`,0,-320,635,23);
    ctx.ui.button('ClaimAll','一键领取',0,-429,460,85,()=>{
      const result=store.claimFreeRewards();
      ctx.tell(result,result.changed?'可领取资源已结算':'暂无可领取资源');
    },palette.gold);
  }

export function quests(ctx: ScreenContext) {
    ctx.title('每日军令',`活跃度 ${store.activePoints()} · 每日刷新`);
    store.questList().slice(0,6).forEach((q: any,i: number)=>ctx.row('Quest'+i,`${q.name}  ${q.count}/${q.target} ${q.claimed?'已领':''}`,350-i*112,()=>ctx.tell(store.claimQuest(q.id),`已领取 ${q.name}`),q.claimed?'已领':q.done?'领取':'查看'));
    items.ACTIVE_CHESTS.forEach((chest: any,i: number)=>{
      const claimed=store.getState().daily.active.includes(i);
      ctx.ui.button('Chest'+i,`${chest.need}活跃 · ${claimed?'已领':'领取'}`,-220+i*220,-337,205,62,
        ()=>ctx.tell(store.claimActiveChest(i),`已领取 ${chest.need} 活跃宝箱`),claimed?palette.green:palette.paperDark);
    });
    ctx.ui.button('ClaimDaily','领取全部可得',0,-430,435,80,()=>{
      const result=store.claimAllDailyRewards();
      ctx.tell(result,result.changed?'可领取军令已结算':'暂无可领取奖励');
    },palette.gold);
  }

export function shop(ctx: ScreenContext) {
    ctx.title('集市','每日限购 · 资源由真实存档结算');
    items.SHOP_GOODS.slice(0,7).forEach((good: any,i: number)=>ctx.row('Shop'+i,`${good.name}  ${good.price} ${store.CURRENCY_NAME[good.cur]}`,352-i*103,()=>ctx.confirm('确认购买',`消耗 ${good.price} ${store.CURRENCY_NAME[good.cur]}，购买 ${good.name}`,()=>ctx.tell(store.buyGood(good.id),`购得 ${good.name}`)),'购买'));
  }

export function formation(ctx: ScreenContext) {
  const s=store.getState();
  ctx.title('出战编队',`五人共享等级 · 总战力 ${fmt.fmtNum(store.teamPower())}`);
  s.formation.forEach((id: string|null,i: number)=>ctx.ui.button('Slot'+i,
    `${i<3?'前排':'后排'} ${i+1}  ${id?heroes.getHero(id)?.name:'空位'}  ·  点击选将`,
    0,335-i*148,580,112,()=>{
      ctx.selectedFormationSlot=i;
      ctx.formationPageIndex=0;
      ctx.go('formationPick');
    },palette.green));
}

export function formationPick(ctx: ScreenContext) {
  const slot=ctx.selectedFormationSlot, s=store.getState();
  const list=store.allRoster().sort((a: any,b: any)=>b.power-a.power);
  const totalPages=Math.max(1,Math.ceil(list.length/6));
  ctx.formationPageIndex=Math.min(ctx.formationPageIndex,totalPages-1);
  ctx.title(`选择${slot<3?'前排':'后排'}武将`,`${list.length} 名已拥有 · 第 ${ctx.formationPageIndex+1}/${totalPages} 页`);
  list.slice(ctx.formationPageIndex*6,ctx.formationPageIndex*6+6).forEach((hero: any,i: number)=>{
    const inTeam=s.formation.includes(hero.id);
    ctx.row('Pick'+i,`${hero.name} · 战力 ${fmt.fmtNum(hero.power)} ${inTeam?'· 已上阵':''}`,
      355-i*111,()=>{
        const next=s.formation.slice(), other=next.indexOf(hero.id), prior=next[slot];
        next[slot]=hero.id;
        if(other>=0&&other!==slot)next[other]=prior;
        const result=store.applyFormation(next);
        ctx.notice=result.ok?`已上阵 ${hero.name}`:result.msg;
        ctx.show(result.ok?'formation':'formationPick');
      },'选用');
  });
  ctx.ui.button('PickPrev','上一页',-162,-405,250,65,()=>{
    ctx.formationPageIndex=Math.max(0,ctx.formationPageIndex-1);ctx.show('formationPick');
  },palette.paperDark);
  ctx.ui.button('PickNext','下一页',162,-405,250,65,()=>{
    ctx.formationPageIndex=Math.min(totalPages-1,ctx.formationPageIndex+1);ctx.show('formationPick');
  },palette.paperDark);
  ctx.ui.button('PickEmpty','撤下该位置',-161,-488,250,64,()=>{
    const next=s.formation.slice();next[slot]=null;
    const result=store.applyFormation(next);
    ctx.notice=result.ok?'已撤下武将':result.msg;
    ctx.show(result.ok?'formation':'formationPick');
  },palette.red);
  ctx.ui.button('PickBack','返回编队',161,-488,250,64,()=>ctx.go('formation'),palette.green);
}

export function tower(ctx: ScreenContext) {
    const n=store.getState().tower.best+1; ctx.title('群英塔',stages.makeTowerEnemies(n).name);
    ctx.ui.rect('Tower',0,0,655,735,palette.green);
    ctx.ui.text('Floor',String(n),0,125,260,150,palette.gold);
    ctx.ui.button('TowerFight','挑战本层',0,-285,460,96,()=>ctx.startBattle('tower',n),palette.red);
  }

export function arena(ctx: ScreenContext) {
    const s=store.getState(); ctx.title('演武场',`积分 ${s.arena.points} · 剩余 ${s.arena.attempts} 次`);
    [0.8,1,1.2].forEach((diff,i)=>ctx.ui.button('Arena'+i,`对手 ${i+1} · 战力约 ${fmt.fmtNum(store.teamPower()*diff)}`,0,260-i*180,570,125,()=>ctx.startBattle('arena',i+1,diff),palette.green));
  }

export function storyView(ctx: ScreenContext) {
    const story=stages.makeStageEnemies(ctx.storyStage).story;
    ctx.title(story?.ch.name || '乱世纷争',story?.stage.name || `第 ${ctx.storyStage} 关`);
    ctx.ui.rect('StoryPaper',0,24,650,730,palette.paper);
    ctx.ui.text('StoryNarration',story?.stage.narration || '两军列阵，战鼓已鸣。',0,240,575,28,palette.ink);
    (story?.stage.dialogue || []).slice(0,3).forEach((line: any,i: number)=>ctx.ui.text('StoryLine'+i,`${heroes.getHero(line.who)?.name || ''}：${line.text}`,0,70-i*105,575,22,palette.ink));
    ctx.ui.button('StoryFight','开始战斗',0,-365,450,90,()=>{
      store.markStorySeen(ctx.storyStage); store.save(); ctx.startBattle('campaign',ctx.storyStage);
    },palette.red);
  }
