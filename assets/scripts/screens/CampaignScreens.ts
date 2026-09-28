import { Color } from 'cc';
import { palette, hexColor as tone } from '../ui/CocosUi';
import { Page, ScreenContext } from './ScreenContext';
import * as store from '../domain/store';
import * as stages from '../domain/stages';
import * as heroes from '../domain/heroes';
import * as items from '../domain/items';
import * as config from '../domain/config';
import * as fmt from '../domain/fmt';
import { recommendFormation } from '../domain/formation';
import { campaignMap, campaignFlag, campaignCamp, cityMap, CITY_BUILDINGS } from '../ui/Scenery';

const INK = tone('#3d4337'), PAPER = tone('#eee3bf'), GOLD = tone('#edcf88'), LIGHT = tone('#f5e8c9');
let chapterMapOpen=false;
let formationRecommended: Array<string|null>|null=null;

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
    U.text('CurrentStageText',`当前 · 第 ${stage} 关${stage>config.FIRST_STAGE_END?' · 循环':''}`,x+18,y-24,165,17,LIGHT);
  }
  U.text('MilestoneHint','主线里程碑：40/100 自选券 · 90/110 自选箱 · 120 完成',0,404,560,15,INK);
  const sd=store.sevenDayInfo();
  if(!sd.allDone){
    const claimable=sd.canClaim;
    U.panel('SevenDayBanner',-60,372,500,44,claimable?tone('#3a2c17'):tone('#2b2118'),7,claimable?GOLD:tone('#6b5837'));
    U.text('SevenDayBannerText',claimable?'七日目标 · 今天有奖励可领 ›':`七日目标 · 第 ${sd.cur} 天 ›`,-60,372,470,18,claimable?GOLD:LIGHT);
    U.tap('SevenDayBannerTap',-60,372,500,44,()=>ctx.go('sevenDay'));
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
  const mins=Math.floor(idle.hours*60);
  U.text('IdleTime',idle.full?'挂机收益已满':`积累 ${Math.floor(mins/60)}时${mins%60}分`,-218,-367,245,19,INK);
  U.text('Idle',`铜钱 ${fmt.fmtNum(idle.gold)} · 精铁 ${idle.iron}（自然 12 小时封顶）`,-156,-391,370,16,tone('#74684a'));
  U.text('IdleRate',`今日元宝 ${idle.gem.claimedGem}/${idle.gem.cap} · 累计未领 ${fmt.fmtNum(idle.gem.pending)}`,-176,-413,330,14,tone('#74684a'));
  U.panel('IdleClaimPanel',232,-393,220,59,palette.gold,9,tone('#a47735'));
  U.text('IdleClaimText',idle.gold||idle.iron?'一键收获':'收益积累中',232,-393,198,25,INK);
  U.tap('IdleClaimTap',232,-393,220,59,()=>ctx.tell(store.claimFreeRewards(),'挂机收益已领取'));
  U.panel('MapButton',-288,-480,103,86,tone('#3a291a'),8,GOLD);
  U.text('MapButtonTitle','征途',-288,-466,90,24,LIGHT);
  U.text('MapButtonSub','本章地图',-288,-494,90,14,tone('#d6c7a1'));
  U.tap('JourneyTap',-288,-480,103,86,()=>{chapterMapOpen=true;ctx.show('campaign');});
  U.panel('AutoButton',0,-480,445,86,ctx.auto?palette.red:tone('#39695a'),10,GOLD);
  U.text('AutoButtonTitle',ctx.auto?'本场后停止':'自动出征',0,-467,422,35,LIGHT);
  U.text('AutoButtonSub',`第 ${stage} 关 · ${enemy.name||chapter.name}`,0,-498,417,15,tone('#e5e5bf'));
  U.tap('AutoTap',0,-480,445,86,()=>ctx.auto?ctx.stopAuto(true):ctx.startAuto('campaign'));
  U.panel('TrainingButton',288,-480,103,86,tone('#3a291a'),8,GOLD);
  U.text('TrainingTitle','练兵',288,-466,90,24,LIGHT);
  U.text('TrainingSub','最多10胜',288,-494,90,14,tone('#d6c7a1'));
  U.tap('TrainingTap',288,-480,103,86,()=>ctx.startAuto('training'));
  U.rect('GoalStrip',0,-536,720,24,tone('#344438'));
  const firstDone=Math.min(s.campaign.cleared,config.FIRST_STAGE_END);
  U.text('GoalHint',firstDone>=config.FIRST_STAGE_END?'第一期主线完成 120/120 · 循环乱世继续开放':`第一期主线 ${firstDone}/${config.FIRST_STAGE_END} · 通关越多，挂机收益越高`,-151,-536,400,16,LIGHT);
  U.text('IdleMore','双倍 / 快收',278,-536,147,16,GOLD);
  U.tap('GoalTap',-150,-536,405,24,()=>ctx.go('stagePreview'));
  U.tap('IdleMoreTap',278,-536,147,24,()=>ctx.idleClaimChoice());
  const retro=store.retroGrants();
  if(retro){
    U.panel('RetroGrants',0,-40,640,54,tone('#2b1e12'),9,GOLD);
    U.text('RetroGrantsText',`旧档补发：${retro.map((g:any)=>`第${g.stage}关 ${g.label}`).join('；')}`,0,-32,560,16,LIGHT);
    U.text('RetroGrantsOk','知道了 ›',0,-54,560,15,GOLD);
    U.tap('RetroGrantsTap',0,-40,640,54,()=>{store.dismissRetroGrants();ctx.show('campaign');});
  }
  campaignHeader(ctx,chapter,stage);
  if(chapterMapOpen){
    U.rect('ChapterMapShade',0,0,720,1280,new Color(12,10,8,190));
    U.tap('ChapterMapShadeTap',0,0,720,1280,()=>{chapterMapOpen=false;ctx.show('campaign');});
    U.panel('ChapterMapPanel',0,0,658,974,tone('#251b14'),12,GOLD);
    U.tap('ChapterMapBlock',0,0,658,974,()=>{});
    U.text('ChapterMapTitle',chapter.name,0,437,590,29,GOLD);
    U.text('ChapterMapCount',`本章征途 · 已通关 ${chapter.inCh}/${stages.STAGES_PER_CH}`,0,393,580,19,LIGHT);
    const first=chapter.idx*stages.STAGES_PER_CH+1;
    U.scroll('ChapterMapList',0,-8,612,741,10*73+12,(V)=>{
      for(let i=0;i<stages.STAGES_PER_CH;i++){
        const n=first+i,y=(10*73+12)/2-37-i*73,current=n===stage,cleared=n<stage;
        const title=stages.makeStageEnemies(n).story?.stage?.name || stages.chapterOf(n).name;
        V.panel('ChapterRow'+i,0,y,600,64,current?tone('#375c4b'):tone('#302b1c'),5);
        V.text('ChapterRowText'+i,`${String(n).padStart(2,'0')}  ${title}`,-111,y,347,22,current?GOLD:LIGHT);
        V.text('ChapterRowState'+i,cleared?'已通关':current?'当前':'未开放',234,y,116,17,current?GOLD:tone('#a99778'));
        if(current)V.tap('ChapterRowTap'+i,0,y,600,64,()=>{chapterMapOpen=false;ctx.go('stagePreview');});
      }
    });
    U.button('ChapterMapClose','返回战役',0,-443,554,55,()=>{chapterMapOpen=false;ctx.show('campaign');},palette.gold);
  }
}

export function stagePreview(ctx: ScreenContext) {
  const stage=store.getState().campaign.cleared+1;
  const enemy=stages.makeStageEnemies(stage), reward=store.campaignRewardPreview(stage);
  const gain=Math.max(0,config.idleRates(stage).gold-config.idleRates(stage-1).gold);
  campaign(ctx);
  const U=ctx.ui,dim=tone('#a99778');
  U.rect('StageModalShade',0,0,720,1280,new Color(12,10,8,190));
  U.tap('StageShadeTap',0,0,720,1280,()=>ctx.back('campaign'));
  U.panel('StagePanel',0,0,658,782,tone('#251b14'),13,tone('#9b793f'));
  U.tap('StagePanelBlock',0,0,658,782,()=>{});
  U.text('StageHeading',`第 ${stage} 关${stage>config.FIRST_STAGE_END?'（循环乱世）':''} · ${enemy.story?.stage?.name||enemy.name||'两军对阵'}`,0,343,600,30,GOLD);
  U.text('StageEnemyTitle',enemy.isBoss?'名将镇守 · 首通奖励':'敌阵与首通奖励',-155,289,311,21,GOLD);
  enemy.units.slice(0,5).forEach((unit:any,i:number)=>{
    const fName=(config.FACTIONS as any)[unit.hero.faction]?.name||'';
    U.text('StageEnemy'+i,`${fName}·${unit.hero.name} Lv.${unit.level}${unit.isBoss?'·首领':''}`,-163,249-i*38,310,19,LIGHT);
  });
  const fCount:any={};
  enemy.units.forEach((unit:any)=>{fCount[unit.hero.faction]=(fCount[unit.hero.faction]||0)+1;});
  const domFaction=Object.keys(fCount).sort((a:string,b:string)=>fCount[b]-fCount[a])[0];
  if(fCount[domFaction]>=4){
    const counterKey=Object.keys(config.BEATS).find((k:any)=>(config.BEATS as any)[k]===domFaction);
    const counterName=counterKey?(config.FACTIONS as any)[counterKey]?.name:'';
    // 光环显示按 ENEMY_FACTION_AURA 折算后的实际生效值，与战斗内一致
    const baseAura=config.factionBonus(fCount[domFaction]).atk;
    const realAura=Math.round(baseAura*(config as any).ENEMY_FACTION_AURA*1000)/10;
    U.text('StageAuraHint',`敌军同阵营×${fCount[domFaction]}（光环生效 +${realAura}%）· ${counterName}阵营对其伤害+25%`,0,62,610,17,tone('#d9a94e'));
  }
  U.panel('StageRewardPanel',0,-45,616,165,tone('#302a1c'),7);
  if(reward.first){
    U.text('StageRewards',`首通必得：元宝 +${reward.totals.gem} · 铜钱 +${fmt.fmtNum(reward.totals.gold)}${reward.totals.scroll?` · 招募令 +${reward.totals.scroll}`:''}`,0,14,589,18,LIGHT);
    U.text('StageArmory','概率奖励：65% 获得随机军械（以实际掉落为准）',0,-22,582,17,dim);
    const msLabels=(reward.milestones||[]).map((m:any)=>m.label);
    U.text('StageIdle',msLabels.length?`里程碑：${msLabels.join('；')}`:`挂机铜钱/时：通关后 +${fmt.fmtNum(gain)}`,0,-62,582,17,GOLD);
  } else {
    U.text('StageRewards',`重复挑战：铜钱 +${fmt.fmtNum(reward.gold)}（无首通奖励）`,0,14,589,18,LIGHT);
    U.text('StageArmory','首通奖励已在首次通关时发放',0,-22,582,17,dim);
    U.text('StageIdle',`挂机铜钱/时：通关后 +${fmt.fmtNum(gain)}`,0,-62,582,17,GOLD);
  }
  const team=store.getState().formation.map((id:string|null)=>id?heroes.getHero(id)?.name:null).filter(Boolean).join(' · ');
  U.text('StageOurTeam',`出战：${team||'尚未编队'}`,0,-159,610,18,dim);
  U.button('StageAuto','自动出征',0,-307,596,66,()=>ctx.startAuto('campaign'),tone('#3d6653'));
  U.text('StageClose','×',302,345,43,28,GOLD);
  U.tap('StageCloseTap',302,345,44,44,()=>ctx.back('campaign'));
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
    U.text('CityIdleMoreText','双倍 / 快收',277,-505,137,16,LIGHT);
    U.tap('CityIdleMoreTap',277,-505,145,52,()=>ctx.idleClaimChoice());
    U.rect('CityHeader',0,551,720,178,PAPER);
    U.panel('CityEmblem',-301,596,83,87,tone('#56695f'),7,GOLD);
    U.text('CityEmblemText','主',-301,596,68,46,GOLD);
    U.text('CityTitle','挂机定三国',-115,616,275,35,INK);
    U.text('CityLord',`主公 · Lv.${store.playerLevel()}`,-133,585,228,19,tone('#766a51'));
    U.text('CityPower',`战力 ${fmt.fmtNum(store.teamPower())}`,252,608,180,18,INK);
    U.text('CityExp',`战斗经验 ${fmt.fmtNum(s.player.exp)}`,254,580,181,15,tone('#766a51'));
    const res:[string,string,number][]=[['铜钱','gold',s.res.gold],['元宝','gem',s.res.gem],['招募令','scroll',s.res.scroll],['精铁','iron',s.res.iron]];
    res.forEach(([label,key,value],i)=>{
      const x=-261+i*174;
      U.panel('CityRes'+key,x,521,164,44,tone('#ddd0b2'),7,tone('#aa9a76'));
      U.text('CityResLabel'+key,label,x-36,521,84,17,tone('#766a51'));
      U.text('CityResValue'+key,fmt.fmtNum(value),x+43,521,79,19,INK);
    });
  }

export function journey(ctx: ScreenContext) {
    const s=store.getState(),U=ctx.ui,armory=store.getArmoryState();
    U.text('JourneyHeading','玩法 · 王庭',-204,521,275,29,GOLD);
    const cards:[Page,string,string,string,string,number,number][]=[
      ['tower','塔','群英塔','无限挑战，节节高升',`已登 ${s.tower.best} 层`,-168,416],
      ['arena','演','演武场','切磋武艺，争锋排名',`${items.arenaRank(s.arena.points)} · 今日剩 ${s.arena.attempts} 次`,168,416],
      ['armory','械','军械图鉴','全军共用，培养六部位',`已解锁 ${armory.unlockedCount}/${armory.total}`,-168,218],
      ['shop','市','集市','每日刷新，奇货可居','每日刷新',168,218]
    ];
    cards.forEach(([page,glyph,name,description,stat,x,y],i)=>{
      U.panel('JourneyCard'+i,x,y,319,177,tone('#312218'),10,tone('#a17b40'));
      U.text('JourneyGlyph'+i,glyph,x-113,y+43,59,49,GOLD);
      U.text('JourneyName'+i,name,x+25,y+44,207,28,LIGHT);
      U.text('JourneyDescription'+i,description,x,y-9,289,18,tone('#ad9977'));
      U.text('JourneyStat'+i,stat,x,y-54,289,19,GOLD);
      U.tap('JourneyTap'+i,x,y,319,177,()=>ctx.go(page));
    });
    U.text('JourneyVersion','「挂机定三国」放置卡牌 · v2.0.0',0,53,580,18,tone('#ad9977'));
    U.text('JourneyGuide','挑战群英塔获取资源，在演武场切磋阵容',0,5,620,18,LIGHT);
    U.text('JourneyGuide2','装备培养与物资兑换也在这里。',0,-20,620,18,LIGHT);
  }

export function bag(ctx: ScreenContext) {
    const s=store.getState(),U=ctx.ui;ctx.title('背包','查看物资 · 了解用途 · 管理装备');
    U.panel('BagResourcesTab',-169,385,308,63,palette.gold,9);
    U.text('BagResourcesText','资源道具',-169,385,283,24,INK);
    U.panel('BagArmoryTab',169,385,308,63,tone('#342518'),9,GOLD);
    U.text('BagArmoryText','军械图鉴',169,385,280,23,GOLD);
    U.tap('BagArmoryTap',169,385,308,63,()=>ctx.go('armory'));
    const resources:[string,string,number,string,string,Page][]=[
      ['钱','铜钱',s.res.gold,'英雄升星与军械部位升星','去培养英雄','heroes'],
      ['铁','精铁',s.res.iron,'解锁军械图鉴、培养部位','去军械图鉴','armory'],
      ['宝','元宝',s.res.gem,'召唤英雄、购买集市物资','前往集市','shop'],
      ['令','招募令',s.res.scroll,'在召唤页面招募新英雄','去召唤英雄','summon'],
      ['武','演武令',s.res.token,'在集市兑换招募令、自选卡','前往集市','shop'],
      ['魂','英雄碎片',s.res.shard,'在集市兑换英雄自选卡','前往集市','shop']
    ];
    resources.forEach(([glyph,name,n,desc,action,page],i)=>{
      const x=i%2?169:-169,y=208-Math.floor(i/2)*210;
      U.panel('BagCard'+i,x,y,310,193,tone('#302219'),9,tone('#795b34'));
      U.panel('BagMarkPanel'+i,x-105,y+54,56,56,tone('#443421'),7);
      U.text('BagMark'+i,glyph,x-105,y+54,46,34,GOLD);
      U.text('BagCardName'+i,name,x+28,y+66,178,24,LIGHT);
      U.text('BagCardCount'+i,fmt.fmtNum(n),x+28,y+34,178,28,GOLD);
      U.text('BagCardDesc'+i,desc,x,y-17,282,19,tone('#ad9977'));
      U.text('BagCardLink'+i,action+' ›',x,y-70,275,18,GOLD);
      U.tap('BagCardTap'+i,x,y,310,193,()=>ctx.go(page));
    });
    U.text('BagGuide','点击物资卡片，前往对应功能使用',0,-458,620,18,tone('#ad9977'));
  }

function questCard(ctx: ScreenContext, V: ScreenContext['ui'], q: any, y: number, optional: boolean) {
  V.panel('QuestCard'+q.id,0,y,639,optional?86:97,tone('#312218'),8,tone('#795b34'));
  V.text('QuestName'+q.id,(optional?'可选 · ':'')+q.name,-159,y+(optional?16:20),319,24,LIGHT);
  V.text('QuestCount'+q.id,`${q.count}/${q.target}`,125,y+23,98,17,tone('#ad9977'));
  const reward=Object.entries(q.reward).map(([key,n])=>`${store.CURRENCY_NAME[key]||key}×${fmt.fmtNum(n)}`).join(' · ');
  V.text('QuestReward'+q.id,reward,-153,y-(optional?14:22),319,17,tone('#ad9977'));
  V.button('QuestClaim'+q.id,q.claimed?'已领取':q.done?'领取':'未完成',236,y,144,optional?52:59,()=>{
    if(!q.done||q.claimed)return;
    ctx.tell(store.claimQuest(q.id),`已领取 ${q.name}`);
  },q.done&&!q.claimed?palette.gold:tone('#423022'));
}

export function quests(ctx: ScreenContext) {
    const U=ctx.ui,quests=store.questList(),active=store.activePoints(),chests=items.ACTIVE_CHESTS;
    ctx.title('每日任务',`活跃度 ${Math.min(100,active)} · 每日 00:00 刷新`);
    const BASIC=['q_idle1','q_battle1','q_win3'];
    const basic=quests.filter((q:any)=>BASIC.includes(q.id)),extra=quests.filter((q:any)=>!BASIC.includes(q.id));
    const contentH=Math.max(805,3*106+40+extra.length*96+40+210);
    U.scroll('QuestScroll',0,-11,665,805,contentH,(V)=>{
      V.text('QuestBasicHeading','今日三件事 · 完成即领满 100 活跃',0,contentH/2-30,600,22,GOLD);
      basic.forEach((q:any,i:number)=>{
        questCard(ctx,V,q,contentH/2-104-i*106,false);
      });
      const extraTop=contentH/2-104-3*106-16;
      V.text('QuestExtraHeading','更多任务（可选，卡关时也能做基础三件事）',0,extraTop,600,19,tone('#ad9977'));
      extra.forEach((q:any,i:number)=>{
        questCard(ctx,V,q,extraTop-48-i*96-43,true);
      });
      const chestY=extraTop-48-extra.length*96-20;
      V.text('QuestActive',`活跃度 ${Math.min(100,active)} · 活跃宝箱`,-141,chestY,340,23,GOLD);
      chests.forEach((chest:any,i:number)=>{
        const claimed=store.getState().daily.active.includes(i),can=active>=chest.need;
        const rewardText=Object.entries(chest.reward).map(([key,n])=>`${store.CURRENCY_NAME[key]||key}×${n}`).join('·');
        const x=-212+i*212;
        V.button('Chest'+i,`${chest.need} 活跃`,x,chestY-42,193,62,()=>{
          if(!can||claimed)return;
          ctx.tell(store.claimActiveChest(i),`已领取 ${chest.need} 活跃宝箱`);
        },can&&!claimed?palette.gold:tone('#423022'));
        V.text('ChestStatus'+i,claimed?'已领取':can?`可领 ${rewardText}`:rewardText,x,chestY-84,183,17,tone('#ad9977'));
      });
    });
    U.button('ClaimDaily','领取全部日常',-167,-484,315,63,()=>{
      const result=store.claimAllDailyRewards();
      ctx.tell(result,result.changed?'可领取军令已结算':'暂无可领取奖励');
    },palette.gold);
    U.button('QuestBack','返 回',167,-484,315,63,()=>ctx.back('campaign'),palette.paperDark);
}

let shopPickRarity=0;
export function shop(ctx: ScreenContext) {
    store.checkDailyReset();
    const U=ctx.ui,s=store.getState(),goods=items.SHOP_GOODS;
    ctx.title('集 市');
    U.text('ShopToday','今 日 商 品（每日刷新）',-176,414,365,24,GOLD);
    U.text('ShopVouchers',`待用自选券：SR ${s.vouchers.sr} · SSR ${s.vouchers.ssr}`,-136,379,464,19,tone('#ad9977'));
    let top=349;
    if(s.vouchers.sr||s.vouchers.ssr){
      if(s.vouchers.sr)U.button('UseSr',`使用 SR 自选券 ×${s.vouchers.sr}`,-171,336,317,48,()=>{shopPickRarity=3;ctx.show('shop');},palette.gold);
      if(s.vouchers.ssr)U.button('UseSsr',`使用 SSR 自选券 ×${s.vouchers.ssr}`,171,336,317,48,()=>{shopPickRarity=4;ctx.show('shop');},palette.gold);
      top=303;
    }
    const height=top+443,contentH=Math.max(height,goods.length*101+62);
    U.scroll('ShopGoods',0,(top-443)/2,680,height,contentH,(V)=>{
      goods.forEach((good:any,i:number)=>{
        const y=contentH/2-51-i*101,bought=s.buyLog.buys[good.id]||0,sold=bought>=good.limit,afford=s.res[good.cur]>=good.price;
        V.panel('ShopGood'+i,0,y,662,92,tone('#312218'),8,tone('#795b34'));
        V.text('ShopName'+i,good.name,-150,y+19,334,26,good.give.ssrPick?GOLD:LIGHT);
        V.text('ShopLimit'+i,`限购 ${bought}/${good.limit}`,-187,y-21,249,18,tone('#ad9977'));
        if(good.give.srPick||good.give.ssrPick)V.text('ShopChoiceTag'+i,'自选',58,y+19,77,17,GOLD);
        V.button('ShopBuy'+i,sold?'售罄':`${fmt.fmtNum(good.price)} ${store.CURRENCY_NAME[good.cur]}`,233,y,198,62,()=>{
          if(sold||!afford)return;
          ctx.confirm('确认兑换',`购买 ${good.name}；消耗 ${fmt.fmtNum(good.price)} ${store.CURRENCY_NAME[good.cur]}。持有 ${fmt.fmtNum(s.res[good.cur])} → 兑换后 ${fmt.fmtNum(s.res[good.cur]-good.price)}`,()=>{
            const r=store.buyGood(good.id);
            if(r.ok&&(good.give.srPick||good.give.ssrPick))shopPickRarity=good.give.ssrPick?4:3;
            ctx.tell(r,`购得 ${good.name}`);
          });
        },sold||!afford?tone('#423022'):palette.gold);
      });
      V.text('ShopTip','满星后的同名卡可兑换碎片；关闭自选窗口不会消耗自选券。',0,contentH/2-51-goods.length*101-16,645,16,tone('#ad9977'));
    });
    U.button('ShopBack','返 回',0,-493,298,56,()=>{shopPickRarity=0;ctx.back('journey');},palette.paperDark);
    if(shopPickRarity){
      const rarity=shopPickRarity,key=rarity===4?'ssr':'sr';
      if(!s.vouchers[key]){shopPickRarity=0;return;}
      U.rect('ShopPickShade',0,0,720,1280,new Color(12,10,8,190));
      U.tap('ShopPickShadeTap',0,0,720,1280,()=>{shopPickRarity=0;ctx.show('shop');});
      U.panel('ShopPickPanel',0,0,658,974,tone('#211911'),12,GOLD);
      U.tap('ShopPickPanelBlock',0,0,658,974,()=>{});
      U.text('ShopPickHeading',rarity===4?'自 选 SSR 名 将':'自 选 SR 名 将',0,449,595,29,GOLD);
      const list=heroes.HEROES.filter((hero:any)=>hero.rarity===rarity),rows=Math.ceil(list.length/3),ch=188,gridH=Math.max(720,rows*ch+12);
      U.scroll('ShopPickGrid',0,-19,622,811,gridH,(V)=>{
        list.forEach((hero:any,i:number)=>{
          const x=-206+i%3*206,y=gridH/2-94-Math.floor(i/3)*ch;
          V.panel('ShopPickCard'+i,x,y,185,177,tone('#322319'),8,rarity===4?GOLD:tone('#795b34'));
          V.heroIcon('ShopPickPortrait'+i,x,y+32,149,89,{surname:hero.surname||hero.name[0],faction:hero.faction,rarity:hero.rarity});
          V.text('ShopPickName'+i,hero.name,x,y-25,166,22,LIGHT);
          V.text('ShopPickTitle'+i,hero.title||'',x,y-51,164,16,tone('#ad9977'));
          V.tap('ShopPickTap'+i,x,y,185,177,()=>{
            const r=store.useChoiceVoucher(rarity,hero.id);
            if(r.ok)shopPickRarity=0;
            ctx.tell(r,r.isNew?`解锁 ${hero.name}`:r.autoStar?`${hero.name} 自动升至 ★${r.star}`:`获得 ${hero.name}`);
          });
        });
      });
      U.button('ShopPickClose','暂不选择',0,-443,290,55,()=>{shopPickRarity=0;ctx.show('shop');},palette.paperDark);
    }
  }

export function formation(ctx: ScreenContext) {
  const s=store.getState(), U=ctx.ui,bonus=store.formationFactionBonus().bonus;
  ctx.title('编 队');
  U.text('FormationBackTop','‹ 返回',-287,609,132,22,GOLD);
  U.tap('FormationBackTopTap',-287,609,138,49,()=>ctx.back('campaign'));
  U.panel('FormationSummary',0,514,682,120,tone('#342518'),11,GOLD);
  U.text('FormationSummaryTitle','出征编队',-204,549,260,28,GOLD);
  U.text('FormationPower',`总战力 ${fmt.fmtNum(store.teamPower())}`,-202,514,270,25,GOLD);
  U.text('FormationFaction',bonus.atk>0?`同阵营 ×${bonus.atk>=.18?5:bonus.atk>=.12?4:3}：攻击/生命 +${Math.round(bonus.atk*100)}%`:'同阵营 3/4/5 人激活全队加成',-181,478,355,18,tone('#ad9977'));
  U.button('FormationRecommend','推荐布阵',244,514,170,55,()=>{
    formationRecommended=recommendFormation(store.allRoster());ctx.show('formation');
  },palette.gold);
  U.text('FormationBackLabel','后 排（远程输出 / 辅助）',0,440,540,19,tone('#ad9977'));
  U.text('FormationFrontLabel','前 排（承伤 / 近战）',0,245,540,19,tone('#ad9977'));
  U.line('FormationDivider',[[-250,267],[250,267]],2,tone('#766349'));
  s.formation.forEach((id: string|null,i: number)=>{
    const x=i<3?-216+i*216:-108+(i-3)*216,y=i<3?162:362;
    const hero=id?heroes.getHero(id):null;
    U.panel('Slot'+i,x,y,188,172,tone('#322319'),9,id?GOLD:tone('#827563'));
    U.heroIcon('SlotAvatar'+i,x,y+25,145,105,hero?{surname:hero.surname||hero.name[0],faction:hero.faction,rarity:hero.rarity}:{surname:'+'});
    U.text('SlotName'+i,hero?.name||'点击上阵',x,y-49,165,21,GOLD);
    U.text('SlotLevel'+i,hero?`Lv.${store.playerLevel()}`:'',x,y-71,150,16,tone('#ad9977'));
    U.tap('SlotTap'+i,x,y,188,172,()=>{ctx.selectedFormationSlot=i;ctx.go('formationPick');});
  });
  U.text('FormationHelp1','点击已上阵武将可更换；阵营克制：魏→蜀→吴→群→魏',0,60,650,18,tone('#ad9977'));
  U.text('FormationHelp2','克制方伤害 +25%',0,35,600,18,tone('#ad9977'));
  if(formationRecommended){
    const recommended=formationRecommended;
    U.rect('FormationRecShade',0,0,720,1280,new Color(12,10,8,190));
    U.tap('FormationRecShadeTap',0,0,720,1280,()=>{formationRecommended=null;ctx.show('formation');});
    U.panel('FormationRecPanel',0,0,618,576,tone('#251b14'),12,GOLD);
    U.tap('FormationRecBlock',0,0,618,576,()=>{});
    U.text('FormationRecTitle','均衡推荐编队',0,248,546,29,GOLD);
    U.text('FormationRecHint','按职业与战力生成建议；不会因抽到新将自动换阵。',0,206,570,17,tone('#ad9977'));
    recommended.forEach((id:string|null,i:number)=>{
      const hero=id?store.allRoster().find((h:any)=>h.id===id):null;
      U.text('FormationRecSlot'+i,`${i+1}号位 · ${i<3?'前排':'后排'} · ${hero?`${hero.name}（战力 ${fmt.fmtNum(hero.power)}）`:'空位'}`,
        0,136-i*52,550,20,hero?LIGHT:tone('#ad9977'));
    });
    U.button('FormationRecCancel','保留当前阵容',-149,-220,271,59,()=>{formationRecommended=null;ctx.show('formation');},tone('#423022'));
    U.button('FormationRecApply','应用推荐编队',149,-220,271,59,()=>{
      formationRecommended=null;ctx.tell(store.applyFormation(recommended),'均衡推荐编队已应用');
    },palette.gold);
  }
}

export function formationPick(ctx: ScreenContext) {
  const slot=ctx.selectedFormationSlot,s=store.getState(),U=ctx.ui;
  const formed=new Set(s.formation);
  const list=store.allRoster().filter((hero:any)=>!formed.has(hero.id)).sort((a:any,b:any)=>b.power-a.power);
  ctx.title(`选 择 武 将（${slot+1}号位）`);
  U.panel('FormationPickerPanel',0,-5,654,918,tone('#2a1e15'),12,GOLD);
  U.button('PickEmpty','卸下该位置',0,382,591,48,()=>{
    const next=s.formation.slice();next[slot]=null;
    const result=store.applyFormation(next);
    if(result.ok){ctx.back('formation');ctx.notice='已撤下武将';ctx.show('formation');}
    else ctx.tell(result,'');
  },tone('#423022'));
  const rows=Math.ceil(list.length/3),contentH=Math.max(707,rows*200+12);
  U.scroll('FormationPickerGrid',0,-26,607,704,contentH,(V)=>{
    list.forEach((hero:any,i:number)=>{
      const col=i%3,row=Math.floor(i/3),x=-201+col*201,y=contentH/2-103-row*200;
      V.panel('PickCard'+i,x,y,184,184,tone('#322319'),8,hero.rarity>=4?GOLD:tone('#795b34'));
      V.heroIcon('PickFace'+i,x,y+39,155,97,{surname:hero.surname||hero.name[0],faction:hero.faction,rarity:hero.rarity});
      V.text('PickName'+i,hero.name,x,y-23,166,22,LIGHT);
      V.text('PickGrade'+i,['','N','R','SR','SSR'][hero.rarity]||'',x+58,y-47,60,17,GOLD);
      V.text('PickLevel'+i,`Lv.${hero.level}`,x-48,y-48,80,17,GOLD);
      V.text('PickPower'+i,`战力 ${fmt.fmtNum(hero.power)}`,x,y-70,170,16,tone('#ad9977'));
      V.tap('PickTap'+i,x,y,184,184,()=>{
        const next=s.formation.slice();next[slot]=hero.id;
        const result=store.applyFormation(next);
        if(result.ok){ctx.back('formation');ctx.notice=`已上阵 ${hero.name}`;ctx.show('formation');}
        else {ctx.notice=result.msg;ctx.show('formationPick');}
      });
    });
    if(!list.length)V.text('PickEmptyText','没有可上阵的武将了',0,contentH/2-80,525,22,tone('#ad9977'));
  });
  U.button('PickBack','返回编队',0,-477,354,63,()=>ctx.back('formation'),palette.paperDark);
}

export function tower(ctx: ScreenContext) {
    const best=store.getState().tower.best,n=best+1,U=ctx.ui;
    ctx.title('群 英 塔');
    U.panel('TowerSummary',0,333,682,116,tone('#312218'),10,GOLD);
    U.text('TowerBest',`已登第 ${best} 层`,-171,360,322,31,GOLD);
    U.text('TowerPower',`我军战力 ${fmt.fmtNum(store.teamPower())} · 每 5 层一名将坐镇`,-104,314,474,18,tone('#ad9977'));
    U.button('TowerFight',`挑战 ${n} 层`,244,339,172,60,()=>ctx.startBattle('tower',n),palette.red);
    const start=Math.max(1,best-2),floors=Array.from({length:11},(_,i)=>start+i),contentH=Math.max(680,floors.length*107);
    U.scroll('TowerFloors',0,-77,688,695,contentH,(V)=>{
      floors.forEach((floor,i)=>{
        const y=contentH/2-54-i*107,cleared=floor<=best,current=floor===n,boss=floor%5===0;
        V.panel('FloorCard'+i,0,y,672,95,tone('#312218'),8,current?GOLD:tone('#795b34'));
        V.panel('FloorSeal'+i,-276,y,68,68,tone('#211c16'),34,current?GOLD:tone('#795b34'));
        V.text('FloorNum'+i,String(floor),-276,y,58,30,current?GOLD:LIGHT);
        V.text('FloorEnemy'+i,boss?'名将层':'寻常守军',-102,y+20,305,24,LIGHT);
        V.text('FloorStatus'+i,cleared?'已通关（可重复挑战）':current?'当前可挑战':'暂无首通奖励',-58,y-23,392,18,tone('#ad9977'));
        V.text('FloorAction'+i,cleared?'复盘':'挑战',279,y,95,22,GOLD);
        V.tap('FloorTap'+i,0,y,672,95,()=>ctx.startBattle('tower',floor));
      });
    });
    U.button('TowerBack','返 回',0,-510,296,56,()=>ctx.back('journey'),palette.paperDark);
  }

export function arena(ctx: ScreenContext) {
    const s=store.getState(),U=ctx.ui;ctx.title('演 武 场');
    U.panel('ArenaSummary',0,335,682,119,tone('#322319'),10,GOLD);
    U.text('ArenaPoints',`${items.arenaRank(s.arena.points)} · ${s.arena.points} 分`,-158,361,340,30,GOLD);
    U.text('ArenaPowerTitle','我军战力',212,366,200,17,tone('#ad9977'));
    U.text('ArenaPower',fmt.fmtNum(store.teamPower()),215,337,200,26,GOLD);
    U.text('ArenaAttempts',`战绩 ${s.arena.wins} 胜 ${s.arena.losses} 负 · 今日剩 ${s.arena.attempts} 次`,-141,302,420,18,tone('#ad9977'));
    U.text('ArenaFormation','调整编队 ›',222,302,198,18,tone('#ad9977'));
    U.tap('ArenaFormationTap',218,328,228,104,()=>ctx.go('formation'));
    U.text('ArenaToday','今 日 对 手',-219,233,235,26,GOLD);
    const date=new Date(),day=date.getFullYear()*10000+(date.getMonth()+1)*100+date.getDate();
    [
      {diff:.8,name:'守碉老卒·1号'},
      {diff:1.05,name:'游历侠客·2号'},
      {diff:1.35,name:'无名猛将·3号'}
    ].forEach((o,i)=>{
      const y=134-i*142,enemy=stages.makeArenaEnemies(store.teamPower(),day*97+i*13,o.diff);
      const power=Math.floor(enemy.units.reduce((sum:number,unit:any)=>sum+heroes.heroPower(unit.hero,unit.level,unit.star),0)*(o.diff>1?o.diff*.98:o.diff));
      U.panel('Arena'+i,0,y,682,126,tone('#312218'),9,o.diff>1.2?GOLD:tone('#8c6a3a'));
      U.text('ArenaEnemy'+i,o.name,-161,y+32,320,26,GOLD);
      U.text('ArenaDifficulty'+i,o.diff>1.2?'凶险':'寻常',267,y+32,115,18,o.diff>1.2?palette.red:tone('#ad9977'));
      U.text('ArenaEnemyPower'+i,`守军约 Lv.${enemy.units[0].level} · 战力 ${fmt.fmtNum(power)}`,-138,y-26,369,18,tone('#ad9977'));
      U.button('ArenaFight'+i,'切 磋',244,y-20,174,54,()=>ctx.startArenaBattle(o.diff,day*97+i*13),palette.red);
    });
    U.text('ArenaRule1','胜得积分与演武令（2~4 按难度），败亦得演武令×1',0,-335,660,18,LIGHT);
    U.text('ArenaRule2','演武令可在集市兑换招募令与自选卡',0,-359,660,18,tone('#ad9977'));
    U.button('ArenaBack','返 回',0,-481,295,59,()=>ctx.back('journey'),palette.paperDark);
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
    U.tap('StoryBackTap',0,-482,318,45,()=>ctx.back('stagePreview'));
  }

const SEVEN_DAY_CN = ['一', '二', '三', '四', '五', '六', '七'];

export function sevenDayView(ctx: ScreenContext) {
  const info=store.sevenDayInfo(),U=ctx.ui;
  ctx.title('七 日 目 标');
  U.text('SevenDayBack','‹ 返回',-291,484,130,22,GOLD);
  U.tap('SevenDayBackTap',-291,484,136,52,()=>ctx.back('campaign'));
  U.text('SevenDayGuide','开服首 7 天每天一份厚礼；漏领可在 7 天内补领',0,443,640,18,tone('#ad9977'));
  info.list.forEach((d:any,i:number)=>{
    const y=375-i*116;
    U.panel('SevenDay'+i,0,y,640,102,
      d.claimed?tone('#26301f'):d.claimable?tone('#3a2c17'):tone('#2b2118'),9,
      d.claimable?GOLD:tone('#6b5837'));
    U.text('SevenDayDay'+i,`第${SEVEN_DAY_CN[i]}天`,-228,y+20,150,26,d.claimable?GOLD:d.claimed?tone('#6f8a5f'):tone('#a99778'));
    U.text('SevenDayLabel'+i,d.label,-66,y-14,360,22,d.locked?tone('#a99778'):LIGHT);
    U.text('SevenDayState'+i,d.claimed?'已领取':d.claimable?'待领取 ›':`第 ${d.day} 天解锁`,205,y+18,160,20,d.claimable?GOLD:d.claimed?tone('#6f8a5f'):tone('#a99778'));
    if(d.claimable)U.tap('SevenDayTap'+i,0,y,640,102,()=>{
      const r=store.claimSevenDay(d.day);
      ctx.tell(r,r.ok?`已领取：${d.label}`:'');
    });
  });
}
