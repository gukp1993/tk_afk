import { palette, hexColor as tone } from '../ui/CocosUi';
import { Page, ScreenContext } from './ScreenContext';
import * as store from '../domain/store';
import * as stages from '../domain/stages';
import * as heroes from '../domain/heroes';
import * as items from '../domain/items';
import * as config from '../domain/config';
import * as fmt from '../domain/fmt';
import { campaignMap, campaignFlag, campaignCamp, cityMap, CITY_BUILDINGS } from '../ui/Scenery';

const INK = tone('#3d4337'), PAPER = tone('#eee3bf'), GOLD = tone('#edcf88'), LIGHT = tone('#f5e8c9');

function campaignHeader(ctx: ScreenContext, chapter: any, stage: number) {
  const U=ctx.ui,s=store.getState(),level=store.playerLevel(),need=store.playerXpNeeded(level);
  U.rect('CampaignHeader',0,567,720,146,tone('#2d3c35'));
  U.panel('CampaignEmblem',-291,586,92,91,tone('#5b7057'),12,GOLD);
  U.text('HanGlyph','汉',-291,587,75,53,GOLD);
  U.text('LordName',s.name||'主公',-183,608,170,29,LIGHT);
  U.text('LordLevel',`Lv.${level}`,-184,573,170,19,tone('#c7cdac'));
  U.panel('GoldPill',70,600,190,49,tone('#24352e'),8);
  U.text('GoldName','铜钱',-8,600,60,16,tone('#c6bc98'));
  U.text('GoldCount',fmt.fmtNum(s.res.gold),116,600,105,23,GOLD);
  U.panel('GemPill',270,600,169,49,tone('#24352e'),8);
  U.text('GemName','元宝',216,600,56,16,tone('#c6bc98'));
  U.text('GemCount',String(s.res.gem),308,600,84,23,GOLD);
  U.progress('LordXp',151,552,388,level>=config.MAX_LEVEL?1:s.player.exp/need,GOLD);
  U.text('TeamPower',`战力 ${fmt.fmtNum(store.teamPower())}`,-240,524,220,19,GOLD);
  U.text('ExpCount',level>=config.MAX_LEVEL?'主公等级已满':`战斗经验 ${fmt.fmtNum(s.player.exp)}/${fmt.fmtNum(need)}`,191,524,320,17,tone('#c7cdac'));
  U.rect('ChapterBar',0,463,720,57,tone('#d9cda7'));
  U.text('ChapterName',chapter.name,-170,463,330,27,INK);
  U.text('ChapterCount',`${chapter.inCh}/${stages.STAGES_PER_CH} 关`,263,463,150,18,tone('#6c6b4c'));
}

export function campaign(ctx: ScreenContext) {
  const s = store.getState(), stage = s.campaign.cleared + 1;
  const chapter = stages.chapterOf(stage), enemy = stages.makeStageEnemies(stage);
  const U = ctx.ui;
  campaignMap(U);
  const segmentStart = chapter.idx * stages.STAGES_PER_CH + 1 + (chapter.inCh < 5 ? 0 : 5);
  const points: Array<[number,number]> = [[150,396],[82.5,316.8],[217.5,237.6],[135,149.6],[243.75,61.6]];
  points.forEach(([x,y], i) => {
    const n = segmentStart+i;
    campaignFlag(U,'StageFlag'+i,x,y,n,n===stage?'current':n<stage?'cleared':'locked',() => {
      if (n === stage) ctx.go('stagePreview');
      else { ctx.notice = `第 ${n} 关 · ${n < stage ? '已通关' : '尚未解锁'}`; ctx.show('campaign'); }
    });
  });
  const current=points[stage-segmentStart];
  if(current){const x=current[0]*720/375-360,y=420-current[1]*660/440;
    U.panel('CurrentStage',x+18,y-24,176,32,tone('#3c6255'),5);
    U.text('CurrentStageText',`当前 · 第 ${stage} 关`,x+18,y-24,165,17,LIGHT);
  }
  const shortcuts: [Page,string][] = [['quests','任务'],['summon','召唤'],['bag','背包'],['armory','军械']];
  shortcuts.forEach(([page,label], i) => {
    const y=355-i*91;
    U.panel('Map'+page,294,y,85,77,tone('#e5d5ad'),8,tone('#74684a'));
    U.text('MapGlyph'+page,label[0],294,y+14,72,31,tone('#536957'));
    U.text('MapLabel'+page,label,294,y-20,72,19,INK);
    U.tap('MapTap'+page,294,y,92,82,()=>ctx.go(page));
  });

  const formation = s.formation.map((id: string|null)=>id ? heroes.getHero(id)?.name || '空' : '空');
  campaignCamp(U,formation);
  U.text('CampHeading','出战阵容',-276,-255,124,18,LIGHT);
  U.text('CampEdit','调整编队 ›',79,-255,150,18,LIGHT);
  formation.forEach((name: string,i: number)=>U.text('CampHero'+i,name||'空',-290+i*92,-336,84,16,LIGHT));
  U.text('ChestLabel','挂机宝箱',236,-331,132,17,LIGHT);
  U.tap('CampEditTap',-118,-296,490,106,()=>ctx.go('formation'));
  U.tap('ChestTap',238,-295,150,100,()=>ctx.idleClaimChoice());

  U.panel('CampaignInfo', 0, -393, 696, 82, tone('#ded2ae'),8);
  const idle = store.idlePending();
  const mins=Math.floor(idle.hours*60),rates=config.idleRates(stage),prior=config.idleRates(stage-1);
  U.text('IdleTime',idle.full?'挂机收益已满':`积累 ${Math.floor(mins/60)}时${mins%60}分`,-218,-367,245,19,INK);
  U.text('Idle',`铜钱 ${fmt.fmtNum(idle.gold)} · 精铁 ${idle.iron} · 招募令 ${idle.scroll}`,-156,-391,370,16,tone('#74684a'));
  U.text('IdleRate',`通关后挂机铜钱/时 +${fmt.fmtNum(Math.max(0,rates.gold-prior.gold))}`,-176,-413,330,14,tone('#74684a'));
  U.panel('IdleClaimPanel',232,-393,220,59,palette.gold,9,tone('#a47735'));
  U.text('IdleClaimText',idle.gold||idle.iron?'一键收获':'收益积累中',232,-393,198,25,INK);
  U.tap('IdleClaimTap',232,-393,220,59,()=>ctx.tell(store.claimFreeRewards(),'挂机收益已领取'));
  U.panel('MapButton',-288,-480,103,86,tone('#3a291a'),8,GOLD);
  U.text('MapButtonTitle','征途',-288,-466,90,24,LIGHT);
  U.text('MapButtonSub','本章地图',-288,-494,90,14,tone('#d6c7a1'));
  U.tap('JourneyTap',-288,-480,103,86,()=>ctx.go('journey'));
  U.panel('AutoButton',0,-480,445,86,ctx.auto?palette.red:tone('#39695a'),10,GOLD);
  U.text('AutoButtonTitle',ctx.auto?'本场后停止':'自动出征',0,-467,422,35,LIGHT);
  U.text('AutoButtonSub',`第 ${stage} 关 · ${enemy.name||chapter.name}`,0,-498,417,15,tone('#e5e5bf'));
  U.tap('AutoTap',0,-480,445,86,()=>ctx.auto?ctx.stopAuto(true):ctx.startAuto('campaign'));
  U.panel('TrainingButton',288,-480,103,86,tone('#3a291a'),8,GOLD);
  U.text('TrainingTitle','练兵',288,-466,90,24,LIGHT);
  U.text('TrainingSub','最多10胜',288,-494,90,14,tone('#d6c7a1'));
  U.tap('TrainingTap',288,-480,103,86,()=>ctx.startAuto('training'));
  U.rect('GoalStrip',0,-536,720,24,tone('#344438'));
  U.text('GoalHint','目标  通关越多，挂机收益越高',-151,-536,400,16,LIGHT);
  U.text('IdleMore','加速 / 双倍',278,-536,147,16,GOLD);
  U.tap('GoalTap',-150,-536,405,24,()=>ctx.go('stagePreview'));
  U.tap('IdleMoreTap',278,-536,147,24,()=>ctx.idleClaimChoice());
  campaignHeader(ctx,chapter,stage);
}

export function stagePreview(ctx: ScreenContext) {
  const stage=store.getState().campaign.cleared+1;
  const enemy=stages.makeStageEnemies(stage), reward=store.campaignRewardPreview(stage);
  const gain=Math.max(0,config.idleRates(stage).gold-config.idleRates(stage-1).gold);
  const U=ctx.ui,dim=tone('#a99778'),dark=tone('#25190f');
  U.rect('StageBackdrop',0,0,720,1280,dark);
  U.text('StageHeading',`第 ${stage} 关 · ${enemy.name || '两军对阵'}`,0,535,660,36,GOLD);
  U.text('StageChapter',stages.chapterOf(stage).name,0,488,560,21,dim);
  U.panel('StagePanel',0,32,680,810,tone('#322319'),14,tone('#8c6a3a'));
  U.text('StageEnemyTitle','敌方阵容',0,385,590,27,GOLD);
  enemy.units.slice(0,5).forEach((unit: any,i: number)=>{
    const x=-267+i*133;
    U.panel('StageEnemyCard'+i,x,245,119,178,tone('#3b2a20'),11,tone('#8d6b68'));
    U.text('StageEnemyGlyph'+i,unit.hero.name[0],x,272,93,61,LIGHT);
    U.text('StageEnemyName'+i,unit.hero.name,x,216,113,19,LIGHT);
    U.text('StageEnemyLevel'+i,`Lv.${unit.level}`,x,187,108,15,dim);
  });
  U.text('StageRewardHeading','首通奖励',0,102,570,26,GOLD);
  U.panel('StageRewardPanel',0,-19,624,159,tone('#241a12'),8,tone('#6e5435'));
  U.text('StageRewards',`铜钱 +${fmt.fmtNum(reward.gold)} · 元宝 +${reward.gem} · 招募令 +${reward.scroll}`,0,22,585,21,LIGHT);
  U.text('StageArmory',reward.armoryBox?'里程碑：军械自选箱 ×1':'65% 概率获得随机军械',0,-19,575,19,dim);
  U.text('StageIdle',`通关后挂机铜钱/时 +${fmt.fmtNum(gain)}`,0,-60,575,18,GOLD);
  const team=store.getState().formation.map((id:string|null)=>id?heroes.getHero(id)?.name:null).filter(Boolean).join(' · ');
  U.text('StageOurTeam',`出战：${team||'尚未编队'}`,0,-141,615,19,dim);
  U.panel('StageManual',-164,-294,292,79,palette.red,9,GOLD);
  U.text('StageManualText','手动挑战',-164,-294,272,26,LIGHT);
  U.tap('StageManualTap',-164,-294,292,79,()=>ctx.startBattle('campaign',stage));
  U.panel('StageAuto',164,-294,292,79,tone('#3d6653'),9,GOLD);
  U.text('StageAutoText','自动出征',164,-294,272,26,LIGHT);
  U.tap('StageAutoTap',164,-294,292,79,()=>ctx.startAuto('campaign'));
  U.panel('StagePreviewBack',0,-417,350,65,tone('#483521'),8,tone('#947346'));
  U.text('StagePreviewBackText','返回战役',0,-417,330,21,LIGHT);
  U.tap('StagePreviewBackTap',0,-417,350,65,()=>ctx.go('campaign'));
}

export function home(ctx: ScreenContext) {
    const s = store.getState(),U=ctx.ui,stage=s.campaign.cleared+1,chapter=stages.chapterOf(stage);
    cityMap(U);
    U.text('CityName','桃 园 主 城',0,420,320,24,INK);
    CITY_BUILDINGS.forEach((b,i)=>{
      const x=(b.x+b.w/2)*720/375-360;
      const y=440-(b.y+b.h)*790/500-28;
      U.panel('BuildingLabel'+i,x,y,Math.max(172,b.w*1.78),70,tone('#eee3c8'),5,tone('#766a51'));
      U.text('BuildingName'+i,b.name,x,y+13,170,27,INK);
      U.text('BuildingHint'+i,b.hint+' ›',x,y-17,170,16,tone('#766a51'));
      U.tap('BuildingTap'+i,x,440-(b.y+b.h/2)*790/500-20,b.w*1.92+15,b.h*790/500+78,()=>ctx.go(b.page as Page));
    });
    [['quests','令','每日任务',-289],['bag','囊','背包',289]].forEach(([page,glyph,label,x],i)=>{
      const px=Number(x);
      U.panel('CityShortcut'+i,px,387,110,101,tone('#e8dcc0'),8,tone('#74684a'));
      U.text('CityShortcutGlyph'+i,String(glyph),px,407,93,37,tone('#677767'));
      U.text('CityShortcutLabel'+i,String(label),px,362,100,17,INK);
      U.tap('CityShortcutTap'+i,px,387,110,101,()=>ctx.go(page as Page));
    });
    U.rect('CityDock',0,-440,720,216,PAPER);
    U.text('CityStage',chapter.name,-156,-350,380,24,INK);
    U.text('CityStageCount',`第 ${stage} 关`,273,-350,135,18,tone('#766a51'));
    U.panel('CityGoal',0,-390,674,40,tone('#ddd0b2'),7);
    U.text('CityGoalText','继续三国征途 · 通过本关提升挂机收益',-42,-390,580,18,INK);
    U.tap('CityGoalTap',0,-390,674,40,()=>ctx.go('stagePreview'));
    U.panel('CityDeploy',-95,-440,489,57,palette.red,8,GOLD);
    U.text('CityDeployText',ctx.auto?'本场后停止':'自动出征',-95,-440,460,28,LIGHT);
    U.tap('CityDeployTap',-95,-440,489,57,()=>ctx.auto?ctx.stopAuto(true):ctx.startAuto('campaign'));
    U.panel('CityTrain',267,-440,165,57,palette.gold,8);
    U.text('CityTrainText','练兵',267,-440,150,23,INK);
    U.tap('CityTrainTap',267,-440,165,57,()=>ctx.startAuto('training'));
    const idle=store.idlePending(),mins=Math.floor(idle.hours*60);
    U.text('CityIdleTitle','挂机宝箱',-256,-493,165,18,INK);
    U.text('CityIdleTime',`已积累 ${Math.floor(mins/60)}时${mins%60}分`,-248,-518,200,15,tone('#766a51'));
    U.panel('CityIdleClaim',62,-505,228,52,palette.gold,7);
    U.text('CityIdleClaimText',idle.gold||idle.iron?'一键收获':'积累中',62,-505,210,19,INK);
    U.tap('CityIdleClaimTap',62,-505,228,52,()=>ctx.tell(store.claimFreeRewards(),'挂机收益已领取'));
    U.panel('CityIdleMore',277,-505,145,52,tone('#3a291a'),7,GOLD);
    U.text('CityIdleMoreText','加速 / 双倍',277,-505,137,16,LIGHT);
    U.tap('CityIdleMoreTap',277,-505,145,52,()=>ctx.idleClaimChoice());
    U.rect('CityHeader',0,551,720,178,PAPER);
    U.panel('CityEmblem',-301,596,83,87,tone('#56695f'),7,GOLD);
    U.text('CityEmblemText','主',-301,596,68,46,GOLD);
    U.text('CityTitle','挂机定三国',-115,616,275,35,INK);
    U.text('CityLord',`主公 · Lv.${store.playerLevel()}`,-133,585,228,19,tone('#766a51'));
    U.text('CityPower',`战力 ${fmt.fmtNum(store.teamPower())}`,252,608,180,18,INK);
    U.text('CityExp',`战斗经验 ${fmt.fmtNum(s.player.exp)}`,254,580,181,15,tone('#766a51'));
    const res:[string,string,number][]=[['铜钱','gold',s.res.gold],['元宝','gem',s.res.gem],['招募令','scroll',s.res.scroll]];
    res.forEach(([label,key,value],i)=>{
      const x=-242+i*242;
      U.panel('CityRes'+key,x,521,225,44,tone('#ddd0b2'),7,tone('#aa9a76'));
      U.text('CityResLabel'+key,label,x-55,521,95,17,tone('#766a51'));
      U.text('CityResValue'+key,fmt.fmtNum(value),x+60,521,95,20,INK);
    });
  }

export function journey(ctx: ScreenContext) {
    const s=store.getState(),U=ctx.ui;ctx.title('玩法 · 王庭','挑战群英塔，演武切磋，经营军械与集市');
    const cards:[Page,string,string,string,number,number][]=[
      ['tower','群英塔','无限挑战，节节高升',`已登 ${s.tower.best} 层`,-168,224],
      ['arena','演武场','切磋武艺，争夺排名',`积分 ${s.arena.points} · 剩余 ${s.arena.attempts} 次`,168,224],
      ['armory','军械图鉴','全军共享，培养六部位','装备与升星',-168,-34],
      ['shop','集市','每日刷新，物资兑换','每日限购',168,-34]
    ];
    cards.forEach(([page,name,description,stat,x,y],i)=>{
      U.panel('JourneyCard'+i,x,y,312,226,tone('#312218'),12,tone('#a17b40'));
      U.text('JourneyGlyph'+i,['塔','演','械','市'][i],x-99,y+55,69,53,GOLD);
      U.text('JourneyName'+i,name,x+18,y+53,200,31,LIGHT);
      U.text('JourneyDescription'+i,description,x,y-12,275,19,tone('#ad9977'));
      U.text('JourneyStat'+i,stat,x,y-76,275,19,GOLD);
      U.tap('JourneyTap'+i,x,y,312,226,()=>ctx.go(page));
    });
    U.panel('JourneyCampaign',-165,-292,309,76,tone('#3d6653'),9,GOLD);
    U.text('JourneyCampaignText',`主线 · 已过 ${s.campaign.cleared} 关`,-165,-292,287,23,LIGHT);
    U.tap('JourneyCampaignTap',-165,-292,309,76,()=>ctx.go('campaign'));
    U.panel('JourneyTraining',165,-292,309,76,tone('#a47a3e'),9,GOLD);
    U.text('JourneyTrainingText','自动练兵 · 最多10胜',165,-292,287,21,INK);
    U.tap('JourneyTrainingTap',165,-292,309,76,()=>ctx.startAuto('training'));
  }

export function bag(ctx: ScreenContext) {
    const s=store.getState(), idle=store.idlePending(),U=ctx.ui;ctx.title('背包','查看物资 · 了解用途 · 管理装备');
    U.panel('BagResourcesTab',-169,385,308,63,palette.gold,9);
    U.text('BagResourcesText','资源道具',-169,385,283,24,INK);
    U.panel('BagArmoryTab',169,385,308,63,tone('#342518'),9,GOLD);
    U.text('BagArmoryText','军械图鉴',169,385,280,23,GOLD);
    U.tap('BagArmoryTap',169,385,308,63,()=>ctx.go('armory'));
    const resources:[string,number,string,Page][]=[
      ['铜钱',s.res.gold,'英雄升星与军械部位升星','heroes'],
      ['精铁',s.res.iron,'解锁军械图鉴、培养部位','armory'],
      ['元宝',s.res.gem,'召唤英雄、购买集市物资','summon'],
      ['招募令',s.res.scroll,'在召唤页面招募新英雄','summon'],
      ['演武令',s.res.token,'进入演武场切磋','arena'],
      ['英雄碎片',s.res.shard,'英雄培养材料','heroes']
    ];
    resources.forEach(([name,n,desc,page],i)=>{
      const x=i%2?169:-169,y=224-Math.floor(i/2)*206;
      U.panel('BagCard'+i,x,y,310,181,tone('#302219'),11,tone('#795b34'));
      U.text('BagCardName'+i,name,x-40,y+51,170,26,LIGHT);
      U.text('BagCardCount'+i,fmt.fmtNum(n),x+53,y+51,124,26,GOLD);
      U.text('BagCardDesc'+i,desc,x,y-14,275,18,tone('#ad9977'));
      U.text('BagCardLink'+i,'查看用途 ›',x,y-64,275,18,GOLD);
      U.tap('BagCardTap'+i,x,y,310,181,()=>ctx.go(page));
    });
    U.text('IdleBag',`待领挂机  铜 ${fmt.fmtNum(idle.gold)} · 铁 ${idle.iron} · 令 ${idle.scroll}`,0,-404,630,20,GOLD);
    U.button('ClaimAll','一键领取',0,-480,453,69,()=>{
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
  const U=ctx.ui;
  ctx.title('出征编队',`五人共享等级 · 总战力 ${fmt.fmtNum(store.teamPower())}`);
  U.panel('FormationSummary',0,336,670,118,tone('#342518'),11,GOLD);
  U.text('FormationSummaryTitle','出征编队',-186,358,270,30,GOLD);
  U.text('FormationPower',`总战力 ${fmt.fmtNum(store.teamPower())}`,-190,317,270,26,GOLD);
  U.text('FormationTip','点击将位，换上已拥有的武将',178,337,310,19,tone('#ad9977'));
  U.text('FormationBackLabel','后排（远程输出 / 辅助）',0,242,510,22,tone('#ad9977'));
  U.text('FormationFrontLabel','前排（承伤 / 近战）',0,-53,510,22,tone('#ad9977'));
  U.scene('FormationDivider',g=>{g.strokeColor=GOLD;g.lineWidth=2;g.moveTo(-300,-18);g.lineTo(300,-18);g.stroke();});
  s.formation.forEach((id: string|null,i: number)=>{
    const x=i<3?-226+i*226:-113+(i-3)*226,y=i<3?-197:118;
    const hero=id?heroes.getHero(id):null;
    U.panel('Slot'+i,x,y,182,192,tone('#322319'),13,id?GOLD:tone('#827563'));
    U.panel('SlotAvatar'+i,x,y+11,142,140,tone('#37463a'),14,id?GOLD:tone('#827563'));
    U.text('SlotGlyph'+i,hero?.name?.[0]||'空',x,y+15,113,73,LIGHT);
    U.text('SlotName'+i,hero?.name||'点击选将',x,y-66,160,20,GOLD);
    U.tap('SlotTap'+i,x,y,182,192,()=>{
      ctx.selectedFormationSlot=i;
      ctx.formationPageIndex=0;
      ctx.go('formationPick');
    });
  });
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
    const n=store.getState().tower.best+1,U=ctx.ui;
    ctx.title('群英塔',`已登 ${n-1} 层 · ${stages.makeTowerEnemies(n).name}`);
    U.panel('TowerPanel',0,39,660,752,tone('#312218'),13,GOLD);
    U.text('TowerLabel','当前挑战层',0,334,560,28,GOLD);
    U.text('Floor',String(n),0,137,300,175,GOLD);
    U.text('TowerEnemy',stages.makeTowerEnemies(n).name,0,-29,570,25,LIGHT);
    U.text('TowerRule','层层登高 · 每层胜利后开启下一层',0,-114,565,20,tone('#ad9977'));
    U.button('TowerFight','挑战本层',0,-322,445,89,()=>ctx.startBattle('tower',n),palette.red);
  }

export function arena(ctx: ScreenContext) {
    const s=store.getState(),U=ctx.ui; ctx.title('演武场',`积分 ${s.arena.points} · 剩余 ${s.arena.attempts} 次`);
    U.panel('ArenaSummary',0,338,670,123,tone('#322319'),12,GOLD);
    U.text('ArenaPoints',`都尉 · ${s.arena.points} 分`,-146,357,344,30,GOLD);
    U.text('ArenaPower',`我军战力 ${fmt.fmtNum(store.teamPower())}`,170,357,298,23,LIGHT);
    U.text('ArenaAttempts',`今日剩余 ${s.arena.attempts} 次 · 胜利可获得积分与演武令`,0,309,626,18,tone('#ad9977'));
    U.text('ArenaToday','今 日 对 手',-216,240,244,27,GOLD);
    [0.8,1,1.2].forEach((diff,i)=>{
      const y=153-i*170,power=Math.round(store.teamPower()*diff);
      U.panel('Arena'+i,0,y,668,145,tone('#312218'),11,tone('#8c6a3a'));
      U.text('ArenaEnemy'+i,['守关老卒 · 1号','游历侠客 · 2号','无名猛将 · 3号'][i],-163,y+31,312,27,GOLD);
      U.text('ArenaEnemyPower'+i,`守军战力约 ${fmt.fmtNum(power)}`,-177,y-15,283,20,tone('#ad9977'));
      U.panel('ArenaFight'+i,218,y,168,65,palette.red,8,GOLD);
      U.text('ArenaFightText'+i,'切磋',218,y,148,25,LIGHT);
      U.tap('ArenaTap'+i,0,y,668,145,()=>ctx.startBattle('arena',i+1,diff));
    });
  }

export function storyView(ctx: ScreenContext) {
    const story=stages.makeStageEnemies(ctx.storyStage).story;
    const U=ctx.ui;
    U.rect('StoryBackdrop',0,0,720,1280,tone('#20160e'));
    U.text('StoryChapter',story?.ch.name || '乱世纷争',0,535,645,39,GOLD);
    U.text('StoryStage',story?.stage.name || `第 ${ctx.storyStage} 关`,0,479,640,23,tone('#a99778'));
    U.panel('StoryPaper',0,64,654,708,tone('#e6d7b3'),12,tone('#a8834f'));
    U.text('StoryNarration',story?.stage.narration || '两军列阵，战鼓已鸣。',0,289,579,27,INK);
    (story?.stage.dialogue || []).slice(0,3).forEach((line: any,i: number)=>{
      const y=129-i*112;
      U.panel('StoryDialogue'+i,0,y,585,83,tone('#d6c49e'),7);
      U.text('StoryLine'+i,`${heroes.getHero(line.who)?.name || ''}：${line.text}`,0,y,552,23,INK);
    });
    U.panel('StoryFight',0,-392,460,78,palette.red,9,GOLD);
    U.text('StoryFightText','开始战斗',0,-392,438,27,LIGHT);
    U.tap('StoryFightTap',0,-392,460,78,()=>{
      store.markStorySeen(ctx.storyStage); store.save(); ctx.startBattle('campaign',ctx.storyStage);
    });
    U.text('StoryBackText','返回关卡预览',0,-482,318,20,GOLD);
    U.tap('StoryBackTap',0,-482,318,45,()=>ctx.go('stagePreview'));
  }
