import { Color, Component, Label, Node, view } from 'cc';
import { palette, hexColor as tone } from '../ui/CocosUi';
import { Page, ScreenContext } from './ScreenContext';
import * as store from '../domain/store';
import * as stages from '../domain/stages';
import * as story from '../domain/story';
import * as heroes from '../domain/heroes';
import * as items from '../domain/items';
import * as config from '../domain/config';
import * as progression from '../domain/progression';
import * as fmt from '../domain/fmt';
import { firstTimeOverlay } from './TutorialOverlay';
import { recommendFormation } from '../domain/formation';
import { ArtService } from '../services/ArtService';
import { campaignMap, campaignFlag, campaignCamp, cityMap, CITY_BUILDINGS, CAMPAIGN_ART_ROUTE } from '../ui/Scenery';

const INK = tone('#3d4337'), PAPER = tone('#eee3bf'), GOLD = tone('#edcf88'), LIGHT = tone('#f5e8c9');
let chapterMapOpen=false;
let chapterMapCh=-1; // 地图浏览章（-1=当前章）
let formationRecommended: Array<string|null>|null=null;

function campaignHeader(ctx: ScreenContext, chapter: any, stage: number) {
  const U=ctx.ui,s=store.getState(),level=store.playerLevel(),need=store.playerXpNeeded(level);
  U.rect('CampaignHeader',0,567,720,146,tone('#2d3c35'));
  const emblem=ArtService.frame('main_emblem');
  if(emblem){U.image('CampaignEmblemArt',emblem,-291,586,92,92);U.text('HanGlyph','汉',-291,586,44,38,GOLD);}
  else {U.panel('CampaignEmblem',-291,586,92,91,tone('#5b7057'),12,GOLD);U.text('HanGlyph','汉',-291,587,75,53,GOLD);}
  U.text('LordName',s.name||'主公',-183,608,170,29,LIGHT);
  U.text('LordLevel',`Lv.${level}`,-184,573,170,19,tone('#c7cdac'));
  U.panel('GoldPill',70,600,190,49,tone('#24352e'),8);
  U.text('GoldName','铜钱',-8,600,60,16,tone('#c6bc98'));
  U.text('GoldCount',fmt.fmtNum(s.res.gold),116,600,105,23,GOLD);
  U.panel('GemPill',270,600,169,49,tone('#24352e'),8);
  U.text('GemName','元宝',216,600,56,16,tone('#c6bc98'));
  U.text('GemCount',String(s.res.gem),308,600,84,23,GOLD);
  U.progress('LordXp',151,552,388,level>=config.MAX_LEVEL?1:s.player.exp/need,GOLD);
  // 设置入口（研讨会七批次乙）：主公面板点击进设置
  U.text('LordSettings','设置 >',-184,545,150,16,tone('#c7cdac'));
  U.tap('LordSettingsTap',-240,560,200,70,()=>ctx.go('settings'));
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
  const verticalScale=Math.max(1,view.getVisibleSize().height/1280);
  campaignMap(U);
  const segmentStart = chapter.idx * stages.STAGES_PER_CH + 1 + (chapter.inCh < 5 ? 0 : 5);
  const points: Array<[number,number]> = CAMPAIGN_ART_ROUTE.map(([x,y])=>[x*375,y*440]);
  points.forEach(([x,y], i) => {
    const n = segmentStart+i;
    campaignFlag(U,'StageFlag'+i,x,y,n,n===stage?'current':n<stage?'cleared':'locked',() => {
      if (n === stage) ctx.go('stagePreview');
      else { ctx.notice = `第 ${n} 关 · ${n < stage ? '已通关' : '尚未解锁'}`; ctx.show('campaign'); }
    });
  });
  const current=points[stage-segmentStart];
  if(current){const x=current[0]*720/375-360,y=420-current[1]*660/440;
    const labelX=x,labelY=y-42;
    U.panel('CurrentStage',labelX,labelY,176,32,tone('#3c6255'),5,undefined,false);
    U.text('CurrentStageText',`第${stage}关${stage>stages.CHAPTERS.length*stages.STAGES_PER_CH?'·循环':''}`,labelX,labelY,165,17,LIGHT);
  }
  U.text('MilestoneHint','主线里程碑：40/100 自选券 · 90/110/150 自选箱 · 120/140/160 完成礼',0,430,560,15,ArtService.has('map_campaign_v2')?INK:LIGHT);
  const sd=store.sevenDayInfo();
  const fdBanner=store.fourteenDayInfo();
  if(sd.allDone&&!fdBanner.allDone){
    U.panel('FourteenBanner',-60,366,500,44,fdBanner.canClaim?tone('#3a2c17'):tone('#2b2118'),7,fdBanner.canClaim?GOLD:tone('#6b5837'));
    U.text('FourteenBannerText',fdBanner.canClaim?'第二周目标 · 有奖励可领 >':`第二周目标 · 第 ${fdBanner.ageDays} 天 >`,-60,366,470,18,fdBanner.canClaim?GOLD:LIGHT);
    U.tap('FourteenBannerTap',-60,366,500,44,()=>ctx.go('sevenDay'));
  }
  if(!sd.allDone&&!sd.expired){
    const claimable=sd.canClaim;
    U.panel('SevenDayBanner',-60,366,500,44,claimable?tone('#3a2c17'):tone('#2b2118'),7,claimable?GOLD:tone('#6b5837'));
    U.text('SevenDayBannerText',claimable?'七日目标 · 今天有奖励可领 >':`七日目标 · 第 ${sd.cur} 天 >`,-60,366,470,18,claimable?GOLD:LIGHT);
    U.tap('SevenDayBannerTap',-60,366,500,44,()=>ctx.go('sevenDay'));
  }
  const starInfo=store.campaignStarChestInfo();
  if(starInfo.claimable){
    U.panel('StarChestBanner',-60,310,500,40,tone('#3a2c17'),7,GOLD);
    U.text('StarChestText','章节星宝箱可领 · 点击领取 >',-60,310,470,18,GOLD);
    U.tap('StarChestTap',-60,310,500,40,()=>{
      const r=store.claimStarChests();
      ctx.tell(r,r.ok?`已领取：${(r.got||[]).join('；')}`:'');
    });
  }
  const shortcuts: [Page,string][] = [['quests','任务'],['summon','召唤'],['bag','背包'],['armory','军械']];
  const shortcutArt: Record<string,string>={quests:'scroll',summon:'nav_heroes',bag:'nav_bag',armory:'armory_weapon'};
  shortcuts.forEach(([page,label], i) => {
    const y=355-i*91;
    U.panel('Map'+page,294,y,85,77,tone('#e5d5ad'),8,tone('#74684a'));
    const icon=ArtService.frame(shortcutArt[page]);
    if(icon)U.image('MapIcon'+page,icon,294,y+16,38,38);
    else U.text('MapGlyph'+page,label[0],294,y+14,72,31,tone('#536957'));
    U.text('MapLabel'+page,label,294,y-21,72,19,INK);
    U.tap('MapTap'+page,294,y,92,82,()=>ctx.go(page));
  });

  campaignCamp(U);
  U.text('CampHeading','出战阵容',-276,-253,124,16,LIGHT);
  U.text('CampEdit','调整编队 >',79,-253,150,16,LIGHT);
  s.formation.slice(0,5).forEach((id: string|null,i: number)=>{
    const hero=id?heroes.getHero(id):null,x=-290+i*92;
    U.heroIcon('CampPortrait'+i,x,-300,64,62*verticalScale,{surname:hero?.name?.[0]||'空',faction:hero?.faction,rarity:hero?.rarity,artKey:id||undefined});
    U.text('CampHero'+i,hero?.name||'空位',x,-340,84,15,LIGHT);
  });
  U.text('ChestLabel','挂机宝箱',236,-347,132,16,LIGHT);
  U.tap('CampEditTap',-106,-300,500,106,()=>ctx.go('formation'));
  U.tap('ChestTap',238,-295,150,100,()=>ctx.idleClaimChoice());

  U.panel('CampaignInfo', 0, -391, 696, 76*verticalScale, tone('#ded2ae'),8);
  const idle = store.idlePending();
  const mins=Math.floor(idle.hours*60);
  const idleTime=idle.full?'收益已满':`${Math.floor(mins/60)}时${mins%60}分`;
  U.text('IdleTime',`${idleTime} · 铜钱 ${fmt.fmtNum(idle.gold)} · 精铁 ${idle.iron}`,-128,-380,408,17,INK);
  U.text('IdleRate',`元宝 ${idle.gem.claimedGem}/${idle.gem.cap} · 待领 ${fmt.fmtNum(idle.gem.pending)} · 铜铁12时封顶`,-128,-403,408,14,tone('#74684a'));
  U.panel('IdleClaimPanel',232,-391,220,59*verticalScale,palette.gold,9,tone('#a47735'));
  U.text('IdleClaimText',idle.gold||idle.iron?'一键收获':'收益积累中',232,-391,198,25,INK);
  U.tap('IdleClaimTap',232,-391,220,59*verticalScale,()=>ctx.tell(store.claimFreeRewards(),'挂机收益已领取'));
  U.panel('MapButton',-288,-471,103,70*verticalScale,tone('#3a291a'),8,GOLD);
  U.text('MapButtonTitle','征途',-288,-458,90,24,LIGHT);
  U.text('MapButtonSub','本章地图',-288,-485,90,14,tone('#d6c7a1'));
  U.tap('JourneyTap',-288,-471,103,70*verticalScale,()=>{chapterMapOpen=true;chapterMapCh=chapter.idx;ctx.show('campaign');});
  U.panel('AutoButton',0,-471,445,70*verticalScale,ctx.auto?palette.red:tone('#39695a'),10,GOLD);
  U.text('AutoButtonTitle',ctx.auto?'本场后停止':'自动出征',0,-459,422,35,LIGHT);
  U.text('AutoButtonSub',`第 ${stage} 关 · ${enemy.name||chapter.name}`,0,-489,417,15,tone('#e5e5bf'));
  U.tap('AutoTap',0,-471,445,70*verticalScale,()=>ctx.auto?ctx.stopAuto(true):ctx.startAuto('campaign'));
  U.panel('TrainingButton',288,-471,103,70*verticalScale,tone('#3a291a'),8,GOLD);
  U.text('TrainingTitle','练兵',288,-458,90,24,LIGHT);
  U.text('TrainingSub','最多10胜',288,-485,90,14,tone('#d6c7a1'));
  U.tap('TrainingTap',288,-471,103,70*verticalScale,()=>ctx.startAuto('training'));
  U.rect('GoalStrip',0,-528,720,40,tone('#344438'));
  const firstDone=Math.min(s.campaign.cleared,config.FIRST_STAGE_END);
  const storyEnd=stages.CHAPTERS.length*stages.STAGES_PER_CH;
  const goalText=firstDone<config.FIRST_STAGE_END
    ?`第一期主线 ${firstDone}/${config.FIRST_STAGE_END} · 通关越多，挂机收益越高`
    :s.campaign.cleared>=storyEnd?`主线全通 ${storyEnd}/${storyEnd} · 循环乱世继续开放`
    :`二期征途 ${s.campaign.cleared}/${storyEnd} · 通关越多，挂机收益越高`;
  U.text('GoalHint',goalText,-151,-528,400,16,LIGHT);
  // 剧情回顾入口提级（批次五①）：由「征途→本章地图→剧情回顾」三级提为战役页一键直达；
  // 热区 64..176 与 GoalTap（-352..52）、双倍快收（188..368）各留 ≥11px 间隙不叠压
  U.text('StoryEntry','剧情回顾 >',120,-528,110,17,GOLD);
  U.tap('StoryEntryTap',120,-528,112,40,()=>ctx.go('storyArchive'));
  U.text('IdleMore','双倍 / 快收',278,-528,180,18,GOLD);
  U.tap('GoalTap',-150,-528,405,40,()=>ctx.go('stagePreview'));
  U.tap('IdleMoreTap',278,-528,180,40,()=>ctx.idleClaimChoice());
  const returnPending=store.getState().returnPending;
  if(returnPending){
    U.panel('ReturnBanner',0,-78,640,54,tone('#3a2c17'),9,GOLD);
    U.text('ReturnBannerText',`主公回来了！离开 ${returnPending.days} 天，回归补给：${returnPending.label}（已入账）>`,0,-70,600,16,GOLD);
    U.tap('ReturnBannerTap',0,-78,640,54,()=>{store.dismissReturnPending();ctx.show('campaign');});
  }
  // 锻造台开启宣告（研讨会六 B1）：第 6 颗 5★ 达成后一次性播报，点击直达锻造台
  if(s.forgeOpenNotice){
    U.panel('ForgeOpenBanner',0,-122,640,44,tone('#3a2c17'),9,GOLD);
    U.text('ForgeOpenBannerText','锻造台已开启 · 词条洗练解锁 >',0,-122,600,17,GOLD);
    U.tap('ForgeOpenBannerTap',0,-122,640,44,()=>{s.forgeOpenNotice=false;store.save();ctx.go('forge');});
  }
  const retro=store.retroGrants();
  if(retro){
    U.panel('RetroGrants',0,-40,640,54,tone('#2b1e12'),9,GOLD);
    U.text('RetroGrantsText',`旧档补发：${retro.map((g:any)=>`第${g.stage}关 ${g.label}`).join('；')}`,0,-32,560,16,LIGHT);
    U.text('RetroGrantsOk','知道了 >',0,-54,560,15,GOLD);
    U.tap('RetroGrantsTap',0,-40,640,54,()=>{store.dismissRetroGrants();ctx.show('campaign');});
  }
  campaignHeader(ctx,chapter,stage);
  if(chapterMapOpen){
    U.rect('ChapterMapShade',0,0,720,1280,new Color(12,10,8,190));
    U.tap('ChapterMapShadeTap',0,0,720,1280,()=>{chapterMapOpen=false;ctx.show('campaign');});
    U.panel('ChapterMapPanel',0,0,658,974,tone('#251b14'),12,GOLD);
    U.tap('ChapterMapBlock',0,0,658,974,()=>{});
    // 章切换（研讨会九 S2：扫荡需回看已通关章节）
    const maxCh=Math.min(stages.CHAPTERS.length-1,Math.floor(s.campaign.cleared/stages.STAGES_PER_CH));
    const viewIdx=Math.min(Math.max(0,chapterMapCh<0?chapter.idx:chapterMapCh),maxCh);
    chapterMapCh=viewIdx;
    const viewCh=stages.chapterOf(viewIdx*stages.STAGES_PER_CH+1);
    U.text('ChapterMapTitle',viewCh.name,0,437,440,29,GOLD);
    U.text('ChapterMapCount',`第${viewIdx+1}章 · 已通关 ${Math.max(0,Math.min(stages.STAGES_PER_CH,s.campaign.cleared-viewIdx*stages.STAGES_PER_CH))}/${stages.STAGES_PER_CH}`,0,393,580,19,LIGHT);
    U.button('ChapterMapPrev','‹',-284,415,56,44,()=>{chapterMapCh=Math.max(0,viewIdx-1);ctx.show('campaign');},viewIdx>0?tone('#5a452a'):tone('#332a1e'));
    U.button('ChapterMapNext','>',284,415,56,44,()=>{chapterMapCh=Math.min(maxCh,viewIdx+1);ctx.show('campaign');},viewIdx<maxCh?tone('#5a452a'):tone('#332a1e'));
    const sw=store.sweepInfo();
    U.text('ChapterMapSweepInfo',sw.enabled?`扫荡 ${sw.left}/${sw.daily} 次 · 三星关可免战速通`:'',0,366,620,16,tone('#a99778'));
    const first=viewIdx*stages.STAGES_PER_CH+1;
    U.scroll('ChapterMapList',0,-30,612,740,10*72+12,(V)=>{
      for(let i=0;i<stages.STAGES_PER_CH;i++){
        const n=first+i,y=(10*72+12)/2-36-i*72,current=(n===stage&&viewIdx===chapter.idx),cleared=n<stage;
        const title=stages.makeStageEnemies(n).story?.stage?.name || stages.chapterOf(n).name;
        const stars=(s.campaign.stars||{})[n]||0;
        const sweepable=cleared&&stars>=3;
        V.panel('ChapterRow'+i,0,y,600,64,current?tone('#375c4b'):tone('#302b1c'),5);
        V.text('ChapterRowText'+i,`${String(n).padStart(2,'0')}  ${title}`,sweepable?-120:-111,y,sweepable?300:347,22,current?GOLD:LIGHT);
        V.text('ChapterRowState'+i,cleared?(stars?'★'.repeat(stars):'已通关'):current?'当前':'未开放',sweepable?70:234,y,sweepable?90:116,17,current?GOLD:tone('#a99778'));
        if(sweepable){
          V.button('ChapterRowSweep'+i,sw.left>0?'扫 荡':'次数尽',220,y-4,116,44,()=>{
            if(sw.left<=0)return;
            const r=store.sweepStage(n);
            ctx.tell(r,r.ok?`扫荡第 ${n} 关：铜钱 +${r.gold} · 经验 +${r.xp}`:'');
          },sw.left>0?palette.gold:tone('#423022'));
        }
        if(current)V.tap('ChapterRowTap'+i,0,y,600,64,()=>{chapterMapOpen=false;ctx.go('stagePreview');});
      }
    });
    U.button('ChapterMapStory','剧情回顾',-145,-443,270,55,()=>{ctx.storyArchiveCh=viewIdx;chapterMapOpen=false;ctx.go('storyArchive');},tone('#3a2b20'));
    U.button('ChapterMapClose','返回战役',145,-443,270,55,()=>{chapterMapOpen=false;ctx.show('campaign');},palette.gold);
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
  U.text('StageHeading',`第 ${stage} 关${stage>stages.CHAPTERS.length*stages.STAGES_PER_CH?'（循环乱世）':''}${enemy.elite?' · 精锐':enemy.mods&&enemy.mods.length?' · 机制':''} · ${enemy.story?.stage?.name||enemy.name||'两军对阵'}`,0,343,600,30,GOLD);
  U.text('StageEnemyTitle',enemy.isBoss?'名将镇守 · 首通奖励':'敌阵与首通奖励',-155,289,311,21,GOLD);
  enemy.units.slice(0,5).forEach((unit:any,i:number)=>{
    // 关卡预览优先用敌将立绘；小兵混编单位仍由阵营色印章兜底。
    const uname=unit.hero?unit.hero.name:unit.name;
    const faction=unit.hero?unit.hero.faction:unit.faction;
    const x=-240+i*120;
    U.panel('StageEnemyCard'+i,x,204,108,126,tone('#30251b'),7,unit.isBoss?GOLD:tone('#725b39'));
    U.heroIcon('StageEnemyPortrait'+i,x,226,68,76,{surname:uname.slice(0,1),faction,rarity:unit.hero?.rarity||unit.rarity||1,artKey:unit.hero?.id||unit.heroId});
    U.text('StageEnemy'+i,uname,x,176,102,18,LIGHT);
    // Narrow phone cards have only ~52 CSS px for metadata. Keep it one short line;
    // the portrait and name already carry faction/identity, so avoid wrapped overflow.
    U.text('StageEnemyMeta'+i,unit.isBoss?`首领 · Lv.${unit.level}`:`Lv.${unit.level}`,x,156,103,16,dim);
  });
  const fCount:any={};
  enemy.units.forEach((unit:any)=>{const f=unit.hero?unit.hero.faction:unit.faction;fCount[f]=(fCount[f]||0)+1;});
  const domFaction=Object.keys(fCount).sort((a:string,b:string)=>fCount[b]-fCount[a])[0];
  if(enemy.mods&&enemy.mods.length){
    const modNames=enemy.mods.map((m:any)=>(config.CAMPAIGN_MODS.meta as any)[m]).filter(Boolean);
    U.text('StageModsHint',`关卡机制 · ${modNames.map((m:any)=>m.name).join(' · ')}`,0,119,620,18,palette.red);
  } else if(enemy.bossMod){
    U.text('StageModsHint',`主将机制 · ${enemy.bossMod.name}：${enemy.bossMod.desc.slice(0,20)}`,0,119,620,18,palette.red);
  }
  if(fCount[domFaction]>=4){
    const counterKey=Object.keys(config.BEATS).find((k:any)=>(config.BEATS as any)[k]===domFaction);
    const counterName=counterKey?(config.FACTIONS as any)[counterKey]?.name:'';
    // 光环显示按 ENEMY_FACTION_AURA 折算后的实际生效值，与战斗内一致
    const baseAura=config.factionBonus(fCount[domFaction]).atk;
    const realAura=Math.round(baseAura*(config as any).ENEMY_FACTION_AURA*1000)/10;
    U.text('StageAuraHint',`同阵营 ${fCount[domFaction]} 人 · 光环 +${realAura}% · ${counterName}克制`,0,91,610,17,tone('#d9a94e'));
  }
  U.panel('StageRewardPanel',0,-18,616,160,tone('#302a1c'),7);
  if(reward.first){
    U.text('StageRewards',`首通奖励 · 元宝 +${reward.totals.gem} · 铜钱 +${fmt.fmtNum(reward.totals.gold)}${reward.totals.scroll?` · 招募令 +${reward.totals.scroll}`:''}`,0,11,589,18,LIGHT);
    U.text('StageArmory','军械掉落概率 65%',0,-22,582,17,dim);
    const msLabels=(reward.milestones||[]).map((m:any)=>m.label);
    U.text('StageIdle',msLabels.length?`里程碑 · ${msLabels.join(' · ')}`:`挂机铜钱/时 +${fmt.fmtNum(gain)}`,0,-55,582,17,GOLD);
  } else {
    U.text('StageRewards',`重复挑战 · 铜钱 +${fmt.fmtNum(reward.gold)}`,0,11,589,18,LIGHT);
    U.text('StageArmory','首通奖励已领取',0,-22,582,17,dim);
    U.text('StageIdle',`挂机铜钱/时 +${fmt.fmtNum(gain)}`,0,-55,582,17,GOLD);
  }
  const team=store.getState().formation.map((id:string|null)=>id?heroes.getHero(id)?.name:null).filter(Boolean).join(' · ');
  U.text('StageStarRule','评星 · 通关 / 限时 60 秒 / 存活 4 人',0,-125,620,18,dim);
  U.text('StageOurTeam',`我方阵容 · ${team||'尚未编队'}`,0,-158,610,19,dim);
  // 战前排兵三选一（试玩 P1 修补：与自动出征按钮完全错开，不再叠压）
  U.text('StageTacticTitle','战前战术 · 可选',0,-207,300,20,tone('#a9bd9f'));
  (config.BATTLE_TACTICS as any[]).forEach((t:any,i:number)=>{
    const x=-196+i*196;
    const armed=(ctx as any).armedTactic===t.id;
    U.panel('StageTactic'+i,x,-248,186,46,armed?tone('#45321b'):tone('#312218'),7,armed?GOLD:tone('#5a452a'));
    U.text('StageTacticName'+i,t.name,x,-235,178,19,armed?GOLD:LIGHT);
    const shortEffect=t.id==='assault'?'攻+10% · 防−5%':t.id==='phalanx'?'防+10% · 攻−5%':'速+5% · 血−4%';
    U.text('StageTacticDesc'+i,shortEffect,x,-260,178,18,tone('#ad9977'));
    U.tap('StageTacticTap'+i,x,-248,186,46,()=>{(ctx as any).armedTactic=(ctx as any).armedTactic===t.id?null:t.id;ctx.show('stagePreview');});
  });
  const armedT=(config.BATTLE_TACTICS as any[]).find((t:any)=>t.id===(ctx as any).armedTactic);
  const autoLbl=armedT?`自动出征 · 战术：${armedT.name}`:'自动出征 · 连战';
  U.button('StageAuto',autoLbl,152,-336,290,54,()=>ctx.startAuto('campaign'),tone('#3d6653'));
  // 单场出战（2026-09-30 补）：唯一的手动首战入口，未读剧情会先插剧情页；败北可看处方单
  U.button('StageOnce','出战一次',-152,-336,290,54,()=>ctx.startBattle('campaign',stage),palette.red);
  U.text('StageClose','×',302,345,43,28,GOLD);
  U.tap('StageCloseTap',302,345,44,44,()=>ctx.back('campaign'));
}

export function home(ctx: ScreenContext) {
    const s = store.getState(),U=ctx.ui,stage=s.campaign.cleared+1,chapter=stages.chapterOf(stage);
    cityMap(U);
    const cityArt=ArtService.has('city_home_v2');
    const cityCenters: Array<[number,number]>=[[.50,.24],[.22,.36],[.78,.36],[.22,.51],[.78,.51],[.50,.635]];
    U.text('CityName','桃 园 主 城',0,420,320,24,cityArt?LIGHT:INK);
    CITY_BUILDINGS.forEach((b,i)=>{
      const [cx,cy]=cityCenters[i];
      const x=cityArt?cx*720-360:(b.x+b.w/2)*720/375-360;
      const y=cityArt?640-cy*1280-68:440-(b.y+b.h)*790/500-28;
      U.panel('BuildingLabel'+i,x,y,cityArt?176:Math.max(172,b.w*1.78),cityArt?58:70,cityArt?new Color(22,35,29,232):tone('#eee3c8'),7,cityArt?GOLD:tone('#766a51'),!cityArt);
      U.text('BuildingName'+i,b.name,x,y+(cityArt?10:13),164,cityArt?25:27,cityArt?LIGHT:INK);
      U.text('BuildingHint'+i,b.hint+' >',x,y-(cityArt?16:17),164,16,cityArt?GOLD:tone('#766a51'));
      U.tap('BuildingTap'+i,x,cityArt?y+35:440-(b.y+b.h/2)*790/500-20,cityArt?190:b.w*1.92+15,cityArt?128:b.h*790/500+78,()=>ctx.go(b.page as Page));
    });
    [['quests','令','每日任务',-289],['bag','囊','背包',289]].forEach(([page,glyph,label,x],i)=>{
      const px=Number(x);
      U.panel('CityShortcut'+i,px,387,110,101,tone('#e8dcc0'),8,tone('#aa9a76'),false);
      U.seal('CityShortcutGlyph'+i,px,405,48,String(glyph),tone('#526958'),GOLD,GOLD,28,page==='bag'?'nav_bag':'scroll');
      U.text('CityShortcutLabel'+i,String(label),px,366,100,17,INK);
      U.tap('CityShortcutTap'+i,px,387,110,101,()=>ctx.go(page as Page));
    });
    U.rect('CityDock',0,-440,720,216,PAPER);
    U.text('CityStage',chapter.name,-156,-350,380,24,INK);
    U.text('CityStageCount',`第 ${stage} 关`,273,-350,135,18,tone('#766a51'));
    const briefing=progression.buildDailyBriefing(s,{
      bountyClaimable:store.bountyInfo().canClaim,
      sevenDayClaimable:!store.sevenDayInfo().allDone&&store.sevenDayInfo().canClaim,
      starChestClaimable:store.campaignStarChestInfo().claimable,
      retroGrants:!!store.retroGrants(),
      arenaAttemptsLeft:s.arena.attempts,
      bountyIdle:store.bountyInfo().idleCount,
      questsClaimable:store.questList().some(q=>q.done&&!q.claimed),
      idleFull:store.idlePending().full
    });
    // 公告覆盖（研讨会七 P2）：回归/补发/锻造开启优先于日常主卡，单行轮替不新增版面
    let goal=briefing.main;
    if(s.forgeOpenNotice)goal={title:'锻造台已开启',desc:'词条洗练解锁 · 点击前往',page:'forge' as Page};
    else if(store.retroGrants())goal={title:'旧档补发待读',desc:'点击查看补发奖励',page:'campaign' as Page};
    else if(s.returnPending)goal={title:'主公回来了！',desc:'回归补给已入账 · 点击查看',page:'campaign' as Page};
    U.panel('CityGoal',0,-390,674,40,s.forgeOpenNotice||store.retroGrants()||s.returnPending?tone('#3a2c17'):tone('#ddd0b2'),7);
    U.text('CityGoalText',goal.title+' · '+goal.desc,-42,-390,580,18,s.forgeOpenNotice||store.retroGrants()||s.returnPending?GOLD:INK);
    U.tap('CityGoalTap',0,-390,674,40,()=>{
      if(goal.page==='forge'&&s.forgeOpenNotice)s.forgeOpenNotice=false;
      ctx.go(goal.page as Page);
    });
    // 设置入口（研讨会七批次乙 P3）：主公头像区域点击（个人位惯例，与本章地图/自动出征无冲突）
    U.text('CitySettings','设置 >',-133,558,120,17,tone('#766a51'));
    U.tap('CitySettingsTap',-200,600,220,84,()=>ctx.go('settings'));
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
      U.panel('CityRes'+key,x,521,164,44,tone('#ddd0b2'),7,tone('#aa9a76'),false);
      U.seal('CityResIcon'+key,x-55,521,28,label[0],tone('#526958'),GOLD,GOLD,15,key);
      U.text('CityResLabel'+key,label,x+18,531,105,13,tone('#766a51'));
      U.text('CityResValue'+key,fmt.fmtNum(value),x+18,513,105,18,INK);
    });
  }

export function journey(ctx: ScreenContext) {
    const s=store.getState(),U=ctx.ui,armory=store.getArmoryState();
    U.text('JourneyHeading','玩法 · 王庭',-204,521,275,29,GOLD);
    const bt=store.bountyInfo(),hi=store.hallInfo(),wk=progression.buildWeeklyBriefing(s,hi.seats);
    const ag=store.dailyAgendaInfo(),dg=store.dungeonInfo(),q=store.quadTowerInfo(),si=store.seasonInfo(),wb=store.weekBossInfo();
    const unread=store.takeBountyGrantsNotice();
    const tq=store.questList().find((qq:any)=>qq.id==='q_tower1');
    type Entry={key:string;glyph:string;name:string;desc:string;stat:string;page?:Page;artKey?:string;dot?:string;active?:boolean;action?:()=>void};
    const today:Entry[]=[],daily:Entry[]=[],weekly:Entry[]=[],services:Entry[]=[];
    if(ag.enabled&&ag.total>0){
      const ns=ag.nextStep?(ag.entries as any[]).find(e=>e.key===ag.nextStep!.key):null;
      today.push({key:'AgendaBand',glyph:'令',name:`今日军务 ${ag.count}/${ag.total}`,desc:ag.count>=ag.total?`今日已清 · 勤勉 ${ag.agendaDays} 天`:`下一步：${ns?ns.label:'稍后再来'}`,stat:'查看每日清单 >',artKey:'scroll',dot:ag.nextStep?.tier==='claim'?'AgendaDot':undefined,active:ag.count<ag.total,action:()=>{agendaOpen=true;ctx.show('journey');}});
    }else today.push({key:'JourneyQuests',glyph:'令',name:'每日任务',desc:'日常挑战与活跃奖励',stat:'查看今日任务 >',page:'quests',artKey:'scroll'});
    daily.push({key:'JourneyCard0',glyph:'塔',name:'群英塔',desc:'无限挑战，节节高升',stat:`已登 ${s.tower.best} 层`,page:'tower',artKey:'feature_tower',dot:tq&&tq.done&&!tq.claimed?'DotJourneyTower':undefined});
    daily.push({key:'JourneyCard1',glyph:'演',name:'演武场',desc:'切磋武艺，争锋排名',stat:`${items.arenaRank(s.arena.points)} · 今日剩 ${s.arena.attempts} 次`,page:'arena',artKey:'feature_arena',dot:s.arena.attempts>0?'DotJourneyArena':undefined,active:s.arena.attempts>0});
    daily.push({key:'JourneyBounty',glyph:'赏',name:'悬赏派遣',desc:'派武将出征，到时领赏 · 每日 4 单',stat:unread?`离线赏金×${unread} 已入账 >`:bt.canClaim?'有赏可领 >':bt.idleCount>0?`待派遣 ${bt.idleCount} 单`:bt.list.some((b:any)=>b.state==='running')?'出征途中':'今日已完成',page:'bounty',artKey:'feature_bounty',dot:bt.canClaim?'DotJourneyBounty':undefined,active:bt.canClaim});
    if(dg.enabled)daily.push({key:'JourneyDungeon',glyph:'屯',name:'军屯双本',desc:`屯金 ${dg.gold.best}/10 · 屯兵 ${dg.train.best}/10`,stat:`今日剩 ${dg.runsLeft} 次 >`,page:'dungeon',artKey:'dungeon_gold',active:dg.runsLeft>0});
    weekly.push({key:'JourneyWeekly',glyph:'周',name:'本周必做',desc:'周任务与活跃宝箱在远征页领取',stat:`任务 ${wk.questsDone}/${wk.questsTotal} · 演武 ${wk.arenaRank}`,page:'expedition',dot:store.weekInfo().canClaim?'DotJourneyWeekly':undefined,active:store.weekInfo().canClaim});
    weekly.push({key:'JourneyHall',glyph:'堂',name:'名人堂',desc:'本周名阵容挑战 · 荣耀与称号',stat:hi.seats.every((x:any)=>x.killed)?`本周全胜 · 荣耀 ${hi.honor}`:`已胜 ${hi.seats.filter((x:any)=>x.killed).length}/3 · 荣耀 ${hi.honor}`,page:'hall',artKey:'honor'});
    if(q.enabled){
      const qname=(config.FACTIONS as any)[q.faction]?.name||q.faction;
      weekly.push({key:'QuadEntry',glyph:'四',name:`四方台 · ${qname}·${q.theme}`,desc:q.owned>0?`本国可战 ${q.owned} 将`:`暂无${qname}将 · 召唤/定向券可补`,stat:`已登 ${q.best}/${q.floors} >`,page:'quad',dot:q.owned>0&&q.unlocked>q.best?'DotJourneyQuad':undefined});
    }
    if(si.enabled)weekly.push({key:'JourneySeason',glyph:'季',name:'四时战纪',desc:`第${si.seasonNo}季 卷${si.vol}·${si.volName}`,stat:`军资簿 Lv${(si.track as any[]).filter(t=>t.claimed).length}${si.claimable?' · 有赏可领':''} >`,page:'season',dot:si.claimable?'JourneySeasonDot':undefined,active:si.claimable});
    if(wb.enabled)weekly.push({key:'JourneyWeekBoss',glyph:'魔',name:`本周魔王 · ${wb.bossName}`,desc:`最高伤害 ${(wb.bestPct*100).toFixed(1)}%`,stat:`今日剩 ${wb.attemptsLeft} 次 >`,page:'weekboss',artKey:'feature_weekboss',active:wb.attemptsLeft>0});
    weekly.push({key:'JourneyWeeklyReplay',glyph:'录',name:'战报回顾',desc:'重温最近的战斗',stat:`最近 ${(store.replaysInfo().list as any[]).length} 场 >`,page:'hall'});
    services.push({key:'JourneyCard2',glyph:'械',name:'军械图鉴',desc:'全军共用，培养六部位',stat:`已解锁 ${armory.unlockedCount}/${armory.total}`,page:'armory',artKey:'feature_armory'});
    services.push({key:'JourneyCard3',glyph:'市',name:'集市',desc:'每日刷新，奇货可居',stat:'兑换物资与自选券 >',page:'shop',artKey:'feature_shop'});
    const groups:[string,Entry[]][]=[['今日军务',today],['日常挑战',daily],['周常与赛季',weekly],['养成服务',services]];
    // 一套纵向预算容纳全部入口；滚区上让页眉/路径条，下缘留在导航上方。
    const contentH=44+groups.reduce((sum,[,entries])=>sum+44+entries.length*132,0);
    U.scroll('JourneyGroups',0,-35,696,970,contentH,V=>{
      let cursor=contentH/2-16;
      groups.forEach(([label,entries],groupIndex)=>{
        V.text('JourneyGroupTitle'+groupIndex,label,-223,cursor-14,230,22,GOLD);
        V.text('JourneyGroupCount'+groupIndex,`${entries.length} 项`,284,cursor-14,72,17,palette.muted);
        cursor-=44;
        entries.forEach(entry=>{
          const y=cursor-60;
          V.panel(entry.key,0,y,674,120,new Color(19,32,27,232),10,entry.active?tone('#a98447'):tone('#506252'),false);
          V.seal(entry.key+'Glyph',-273,y+12,58,entry.glyph,palette.ink,tone('#7b7652'),GOLD,30,entry.artKey);
          V.text(entry.key+'Name',entry.name,-20,y+28,410,26,LIGHT);
          V.text(entry.key+'Desc',entry.desc,-20,y-4,410,18,palette.muted);
          V.text(entry.key+'Stat',entry.stat,0,y-35,610,19,entry.active?GOLD:tone('#c5c6ab'));
          V.text(entry.key+'Arrow','›',303,y+10,40,32,GOLD);
          if(entry.dot)V.dot(entry.dot,283,y+42);
          V.tap(entry.key+'Tap',0,y,674,120,entry.action||(()=>ctx.go(entry.page!)));
          cursor-=132;
        });
      });
    });
  firstTimeOverlay(ctx,'agenda');
  // 今日军务展开弹层（研讨会十二 C1）：11 条清单+勤勉进度+一键前往
  if(agendaOpen){
    const ag=store.dailyAgendaInfo();
    if(ag.enabled&&ag.total>0){
      U.rect('AgendaShade',0,0,720,1280,new Color(12,10,8,190));
      U.tap('AgendaShadeTap',0,0,720,1280,()=>{agendaOpen=false;ctx.show('journey');});
      U.panel('AgendaPanel',0,0,658,974,tone('#251b14'),12,GOLD);
      U.tap('AgendaBlock',0,0,658,974,()=>{});
      U.text('AgendaTitle','今 日 军 务',0,437,440,29,GOLD);
      U.text('AgendaSub',`今日 ${ag.count}/${ag.total} · 满 ${ag.fullCount} 项记勤勉 · 已累计 ${ag.agendaDays} 天${ag.titled?` · 已获「${ag.titleName}」`:''}`,0,393,600,17,ag.titled?GOLD:tone('#ad9977'));
      const rows=ag.entries.length,contentH=rows*64+16;
      U.scroll('AgendaScroll',0,-30,612,700,contentH,(V)=>{
        ag.entries.forEach((e:any,i:number)=>{
          const y=contentH/2-32-i*64;
          V.panel('AgendaRow'+i,0,y,600,56,e.done?tone('#26301f'):tone('#302b1c'),7,e.done?tone('#6f8a5f'):tone('#3f3424'));
          V.text('AgendaDotMark'+i,e.done?'●':'○',-266,y,30,22,e.done?GOLD:tone('#7a6c52'));
          V.text('AgendaLabel'+i,`${e.label} ${e.cur}/${e.target}`,-150,y,360,19,e.done?tone('#a99778'):LIGHT);
          V.text('AgendaGo'+i,'前往 >',250,y,120,18,e.done?tone('#6f8a5f'):GOLD);
          V.tap('AgendaRowTap'+i,0,y,600,56,()=>{agendaOpen=false;ctx.go(e.page as any);});
        });
      });
      U.button('AgendaClose','返 回',0,-443,270,55,()=>{agendaOpen=false;ctx.show('journey');},palette.paperDark);
    } else agendaOpen=false;
  }
  }

// 周常 Boss（研讨会四 P3）：每周 SSR 魔王，3 次挑战按最高伤害百分比定档
export function weekBossView(ctx: ScreenContext) {
  const U=ctx.ui,wb=store.weekBossInfo();
  ctx.title('魔王 讨 伐');
  U.backBar(()=>ctx.back('journey'));
  if(!wb.enabled){
    U.text('WbClosed','魔王讨伐暂未开放',0,200,600,20,LIGHT);
    return;
  }
  U.panel('WbBossCard',0,330,682,150,tone('#2a1210'),12,palette.red);
  U.seal('WbBossGlyph',-272,340,64,'魔',palette.red,palette.red,tone('#f0e6cd'),34,'weekboss');
  U.text('WbBossName',wb.bossName,60,362,300,30,GOLD);
  U.text('WbBossSub','本周魔王 · 全服同敌 · 伤害定档',60,330,340,17,tone('#ad9977'));
  U.text('WbBest',`本周最高伤害：${(wb.bestPct*100).toFixed(1)}%`,60,300,340,19,GOLD);
  U.button('WbGo',wb.attemptsLeft>0?`讨 伐（剩 ${wb.attemptsLeft} 次）`:'本周次数已用完',0,240,460,64,()=>ctx.startWeekBoss(),wb.attemptsLeft>0?palette.red:tone('#423022'));
  U.text('WbRule','每次挑战按当次伤害档位发奖；纪录只进榜不重复发奖',0,190,620,16,tone('#ad9977'));
  U.text('WbTierTitle','伤害档位 · 印信与演武令',0,140,620,19,LIGHT);
  wb.tiers.forEach((t:any,i:number)=>{
    const y=88-i*54;
    U.panel('WbTier'+i,0,y,640,46,t.reached?tone('#3a2c17'):tone('#171009'),7,t.reached?GOLD:tone('#5a452a'));
    U.text('WbTierPct'+i,`伤害 > ${(t.pct*100).toFixed(1).replace(/\.0$/,'')}%`,-170,y,300,18,t.reached?GOLD:LIGHT);
    const rw=Object.entries(t.reward).map(([k,n]:any)=>`${({seals:'印信',token:'演武令'} as any)[k]||k}×${n}`).join(' · ');
    U.text('WbTierReward'+i,(t.reached?'已达标 · ':'')+rw,150,y,300,17,t.reached?GOLD:tone('#ad9977'));
  });
  U.text('WbHint','伤害 = 全队对魔王输出占其血量比例；魔王强度随主公等级',0,-260,640,16,tone('#7a6c52'));
  // 升档进度条（研讨会十二 B1）：当前纪录相对下一档的达成度 + 差值文案
  {
    const topPct=(wb.tiers[0]&&wb.tiers[0].pct)||0.06;
    const next=(wb.tiers as any[]).find(t=>t.pct>0&&!t.reached);
    const frac=Math.max(0.02,Math.min(1,(wb.bestPct||0)/(next?next.pct:topPct)));
    U.rect('WbProgBkg',0,-200,600,12,new Color(20,14,10,220));
    U.rect('WbProgFill',-300+300*frac,-200,600*frac,12,new Color(150,90,70,235));
    U.text('WbProgTxt',next?`距下一档（>${(next.pct*100).toFixed(1)}%）还差 ${Math.max(0.1,(next.pct-(wb.bestPct||0))*100).toFixed(1)}% 伤害`:'已达最高档 · 本周纪录待刷新',0,-220,620,17,GOLD);
  }
  U.button('WbBackBtn','返 回',0,-500,295,52,()=>ctx.back('journey'),palette.paperDark);
  firstTimeOverlay(ctx,'weekboss');
}

// 设置页（研讨会七批次乙 P3）：最小版——版本/存档诊断/重看教程/战斗倍速
export function settingsView(ctx: ScreenContext) {
  const U=ctx.ui,s=store.getState();
  ctx.title('设 置');
  U.backBar(()=>ctx.back('home'));
  U.panel('SetVersion',0,400,682,70,tone('#312218'),9,tone('#795b34'));
  U.text('SetVersionText','挂机定三国 v2.0.0 · 微信小游戏',0,414,640,19,LIGHT);
  U.text('SetVersionSub',`存档版本 v${s.v} · 建号 ${new Date(s.createdAt).toLocaleDateString('zh-CN')}`,0,386,640,15,tone('#ad9977'));
  U.panel('SetTut',0,300,682,70,tone('#312218'),9,tone('#795b34'));
  U.text('SetTutText','新手说明',-250,316,200,19,LIGHT);
  U.text('SetTutDesc','已看过说明的场景将重新弹出一次',-130,286,420,15,tone('#ad9977'));
  U.button('SetTutGo','重看教程',210,300,170,50,()=>{store.resetTutorials();ctx.tell({ok:true},'下次进入各玩法将重新显示说明');},palette.gold);
  U.panel('SetDiag',0,180,682,90,tone('#312218'),9,tone('#795b34'));
  U.text('SetDiagText','存档诊断',-250,196,200,19,LIGHT);
  U.text('SetDiagDesc','生成只读经济快照，供验收反馈回传',-130,166,430,15,tone('#ad9977'));
  U.button('SetDiagGo','生成诊断',210,180,170,50,()=>{
    const snap=store.diagSnapshot();
    const lines=[
      '推图 '+snap.campaign.cleared+' 关 · 主公 Lv.'+snap.playerLevel,
      '铜钱 '+fmt.fmtNum(snap.currencies.gold)+' · 元宝 '+fmt.fmtNum(snap.currencies.gem)+' · 精铁 '+fmt.fmtNum(snap.currencies.iron),
      '招募令 '+snap.currencies.scroll+' · 演武令 '+snap.currencies.token+' · 印信 '+snap.currencies.seals,
      '军械 '+snap.systems.dungeon.bestGold+'/'+snap.systems.dungeon.bestTrain+' 层 · 操练 '+snap.systems.drill.totalLevels+' 级',
      '（完整 JSON 见控制台 __tkDiag()）'
    ];
    ctx.confirm('存档诊断快照',lines.join('\n'),()=>{});
  },palette.gold);
  U.panel('SetSpeed',0,60,682,70,tone('#312218'),9,tone('#795b34'));
  U.text('SetSpeedText','战斗倍速',-250,76,200,19,LIGHT);
  U.text('SetSpeedDesc','战斗页亦可随时切换（×1/×2/×4）',-130,46,420,15,tone('#ad9977'));
  const sp=s.settings&&s.settings.autoBattleSpeed||1;
  U.button('SetSpeedGo','×'+sp,210,60,170,50,()=>{const r=store.setAutoBattleSpeed(sp===4?1:sp===2?4:2);ctx.tell(r,'倍速已切换 ×'+r.speed);},palette.gold);
  U.text('SetHint','更多设置（音效/震动/账号）随版本更新加入',0,-20,640,15,tone('#7a6c52'));
  U.button('SetBackBtn','返 回',0,-470,295,52,()=>ctx.back('home'),palette.paperDark);
}

// 军屯双本（研讨会四 P2）：每日 2 次，双轨 10 层顺序解锁
export function dungeonView(ctx: ScreenContext) {
  const U=ctx.ui,info=store.dungeonInfo();
  ctx.title('军 屯 双 本');
  U.backBar(()=>ctx.back('journey'));
  U.text('DungeonGuide',`每日 ${info.daily} 次 · 双轨共用次数 · 层数顺序解锁 · 敌力随主公等级缩放`,0,443,640,18,tone('#ad9977'));
  U.text('DungeonRuns',`今日剩余次数：${info.runsLeft} / ${info.daily}`,0,404,640,20,info.runsLeft>0?GOLD:tone('#a99778'));
  const tracks=[
    { key:'gold', name:'屯金本', glyph:'金', desc:'胜利奖励铜钱', best:info.gold.best, next:info.gold.next, elv:info.gold.enemyLevel, rp:info.gold.rewardPreview?`铜钱 ${fmt.fmtNum(info.gold.rewardPreview)}`:'', color:tone('#d9a94e') },
    { key:'train', name:'屯兵本', glyph:'兵', desc:'胜利奖励主公经验', best:info.train.best, next:info.train.next, elv:info.train.enemyLevel, rp:info.train.next?`经验 ${60+15*info.train.enemyLevel}`:'', color:tone('#7fbd94') }
  ];
  tracks.forEach((t:any,i:number)=>{
    const x=i%2===0?-171:171, y=170;
    U.panel('DungeonTrack'+i,x,y,330,300,tone('#312218'),10,t.color);
    U.seal('DungeonGlyph'+i,x,y+108,56,t.glyph,t.color,t.color,tone('#3a2b20'),30,'dungeon_'+t.key);
    U.text('DungeonName'+i,t.name,x-70,y+112,220,26,GOLD);
    U.text('DungeonDesc'+i,t.desc,x,y-120,300,17,tone('#ad9977'));
    U.text('DungeonBest'+i,t.best>0?`已通 ${t.best}/10 层`:'尚未挑战',x,y+64,300,20,LIGHT);
    if(t.next){
      U.text('DungeonNext'+i,`下一层 · 第 ${t.next} 层（敌约 Lv.${t.elv}）`,x,y+22,300,18,tone('#d9b06a'));
      U.text('DungeonReward'+i,`首通奖励：${t.rp}`,x,y-14,300,17,GOLD);
      U.button('DungeonGo'+i,info.runsLeft>0?`挑 战 第 ${t.next} 层`:'次数已用完',x,y-70,280,56,()=>{
        if(info.runsLeft<=0)return;
        ctx.startDungeonBattle(t.key,t.next);
      },info.runsLeft>0?palette.red:tone('#423022'));
    } else {
      U.text('DungeonNext'+i,'10 层全部通过',x,y+22,300,18,GOLD);
      U.text('DungeonReward'+i,'每日 2 次重打任意已通层',x,y-14,300,16,tone('#ad9977'));
      if(t.best>0)U.button('DungeonGo'+i,info.runsLeft>0?`重打第 ${t.best} 层`:'次数已用完',x,y-70,280,56,()=>{
        if(info.runsLeft<=0)return;
        ctx.startDungeonBattle(t.key,t.best);
      },info.runsLeft>0?palette.paperDark:tone('#423022'));
    }
  });
  U.text('DungeonRule','层数每日不重置；敌方等级随主公等级与层数缩放，战力不足先回主线发育',0,-470,640,16,tone('#7a6c52'));
  U.button('DungeonBackBtn','返 回',0,-510,295,52,()=>ctx.back('journey'),palette.paperDark);
  firstTimeOverlay(ctx,'dungeon');
}

export function bag(ctx: ScreenContext) {
    const s=store.getState(),U=ctx.ui;ctx.title('背包','查看物资 · 了解用途 · 管理装备');
    // 卡片高度固定，卡内偏移抵消页面纵向适配，长屏也保留图文边距。
    const cardInsetScale=1280/view.getVisibleSize().height;
    U.panel('BagResourcesTab',-169,385,308,63,palette.gold,9);
    U.text('BagResourcesText','资源道具',-169,385,283,24,INK);
    U.panel('BagArmoryTab',169,385,308,63,tone('#342518'),9,GOLD);
    U.text('BagArmoryText','军械图鉴',169,385,280,23,GOLD);
    U.tap('BagArmoryTap',169,385,308,63,()=>ctx.go('armory'));
    const resources:any[]=[
      ['钱','铜钱',s.res.gold,'英雄升星与军械部位升星','去培养英雄','heroes','gold'],
      ['铁','精铁',s.res.iron,'解锁军械图鉴、培养部位','去军械图鉴','armory','iron'],
      ['宝','元宝',s.res.gem,'召唤英雄、购买集市物资','前往集市','shop','gem'],
      ['令','招募令',s.res.scroll,'在召唤页面招募新英雄','去召唤英雄','summon','scroll'],
      ['武','演武令',s.res.token,'在集市兑换招募令、自选卡','前往集市','shop','token'],
      ['魂','英雄碎片',s.res.shard,'在集市兑换英雄自选卡','前往集市','shop','shard']
    ];
    resources.forEach(([glyph,name,n,desc,action,page,artKey],i)=>{
      const x=i%2?169:-169,y=208-Math.floor(i/2)*210;
      U.panel('BagCard'+i,x,y,310,193,tone('#302a22'),9,tone('#806c49'),false);
      U.seal('BagMark'+i,x-105,y+54*cardInsetScale,56,glyph,tone('#443421'),GOLD,GOLD,34,artKey);
      U.text('BagCardName'+i,name,x+28,y+66*cardInsetScale,178,24,LIGHT);
      U.text('BagCardCount'+i,fmt.fmtNum(n),x+28,y+34*cardInsetScale,178,28,GOLD);
      U.text('BagCardDesc'+i,desc,x,y-17*cardInsetScale,282,19,tone('#ad9977'));
      U.text('BagCardLink'+i,action+' >',x,y-70*cardInsetScale,275,18,GOLD);
      U.tap('BagCardTap'+i,x,y,310,193,()=>ctx.go(page));
    });
    // 神兵阁（研讨会十三案二）：通关 160 关解锁后追加第四入口行（行距收紧保 -548 红线）
    const relicUnlocked=(config.RELICS as any).enabled&&(store.relicInfo() as any).unlocked;
    if(!relicUnlocked)U.text('BagGuide','点击物资卡片，前往对应功能使用',0,-332,620,18,tone('#ad9977'));
    const entries:[string,string,string][]=[['典','图鉴收集 · 集齐阵营领厚礼','codex'],['勋','主公成就 · 十一轴长线目标','achv'],['远','远征周 · 周任务与词缀挑战','expedition']];
    if(relicUnlocked)entries.push(['神','神兵阁 · 传世宝物认主与淬炼','relics']);
    const eStep=relicUnlocked?56:64, eStart=relicUnlocked?-350:-372, eH=relicUnlocked?48:52;
    entries.forEach(([glyph,label,page]:any,i:number)=>{
      const ey=eStart-i*eStep;
      U.panel('BagEntry'+i,0,ey,682,eH,tone('#302a22'),8,tone('#806c49'),false);
      U.text('BagEntryGlyph'+i,String(glyph),-290,ey,44,30,GOLD);
      U.text('BagEntryLabel'+i,String(label),-128,ey,400,19,LIGHT);
      U.text('BagEntryGo'+i,'>',290,ey,40,19,GOLD);
      U.tap('BagEntryTap'+i,0,ey,682,eH,()=>ctx.go(page as Page));
    });
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

// 商品图章与价签共用物资图；自选券保留品质边色并以招募卷轴表示。
function shopProductMark(V: ScreenContext['ui'], name: string, good: any, y: number) {
  const give=good.give||{};
  const key=give.gold?'gold':give.scroll?'scroll':give.shard?'shard':give.token?'token':give.armoryBox?'iron':'scroll';
  const rarity=give.ssrPick||give.armoryBox===3?4:give.srPick||give.armoryBox===2?3:0;
  const border=rarity===4?GOLD:rarity===3?tone('#bd91da'):tone('#806c49');
  V.panel(name+'Frame',-280,y,64,64,tone('#3c352b'),9,border,false);
  V.seal(name,-280,y,56,good.name[0],tone('#443421'),border,GOLD,28,key);
}

function shopPrice(V: ScreenContext['ui'], name: string, good: any, y: number, status: string,
  fill: Color, action: () => void) {
  V.panel(name,233,y,198,62,fill,8,tone('#a58c5a'),false);
  const light=fill.r*.299+fill.g*.587+fill.b*.114>145;
  const color=light?INK:LIGHT;
  if(status) V.text(name+'Text',status,233,y,182,22,color);
  else {
    V.seal(name+'Currency',164,y,28,store.CURRENCY_NAME[good.cur]?.[0]||'币',tone('#443421'),GOLD,GOLD,16,good.cur);
    V.text(name+'Text',fmt.fmtNum(good.price),251,y+10,137,23,color);
    V.text(name+'CurrencyName',store.CURRENCY_NAME[good.cur],251,y-15,137,14,color);
  }
  V.tap(name+'Touch',233,y,198,62,action);
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
    const roamer=store.roamerInfo();
    const roamerRows=roamer.goods.length;
    const roamerBlockH=roamerRows?60+roamerRows*101:0;
    const height=top+443,contentH=Math.max(height,goods.length*101+62+roamerBlockH);
    U.scroll('ShopGoods',0,(top-443)/2,680,height,contentH,(V)=>{
      let cursor=contentH/2;
      if(roamerRows){
        V.text('RoamerTitle','神秘商人 · 今日限量（跨日换新）',0,cursor-27,600,22,GOLD);
        cursor-=60;
        roamer.goods.forEach((good:any,ri:number)=>{
          const y=cursor-51;cursor-=101;
          V.panel('RoamerGood'+ri,0,y,662,92,tone('#343026'),8,tone('#a58c5a'),false);
          shopProductMark(V,'RoamerIcon'+ri,good,y);
          V.text('RoamerName'+ri,good.name,-54,y+18,332,24,LIGHT);
          V.text('RoamerLimit'+ri,good.bought?'今日已购 · 明日换新':'限量 1 件 · 今日有效',-54,y-20,332,16,good.bought?tone('#92ad7c'):tone('#d9bd7b'));
          shopPrice(V,'RoamerBuy'+ri,good,y,good.bought?'已购':'',good.bought||s.res[good.cur]<good.price?tone('#423a2d'):palette.red,()=>{
            if(good.bought)return;
            ctx.confirm('确认购买',`向神秘商人购买 ${good.name}；消耗 ${fmt.fmtNum(good.price)} ${store.CURRENCY_NAME[good.cur]}。`,()=>{
              ctx.tell(store.buyRoamer(good.id),`购得 ${good.name}`);
            });
          });
        });
      }
      goods.forEach((good:any,i:number)=>{
        const y=cursor-51-i*101,bought=s.buyLog.buys[good.id]||0,sold=bought>=good.limit,afford=s.res[good.cur]>=good.price;
        V.panel('ShopGood'+i,0,y,662,92,tone('#302a22'),8,tone('#806c49'),false);
        shopProductMark(V,'ShopIcon'+i,good,y);
        V.text('ShopName'+i,good.name,-54,y+18,332,24,good.give.ssrPick?GOLD:LIGHT);
        const choice=good.give.srPick||good.give.ssrPick?' · 自选':'';
        V.text('ShopLimit'+i,`限购 ${bought}/${good.limit}${choice}${!sold&&!afford?' · 余额不足':''}`,-54,y-20,332,16,tone('#c1ae87'));
        shopPrice(V,'ShopBuy'+i,good,y,sold?'售罄':'',sold||!afford?tone('#423a2d'):palette.gold,()=>{
          if(sold||!afford)return;
          ctx.confirm('确认兑换',`购买 ${good.name}；消耗 ${fmt.fmtNum(good.price)} ${store.CURRENCY_NAME[good.cur]}。持有 ${fmt.fmtNum(s.res[good.cur])} → 兑换后 ${fmt.fmtNum(s.res[good.cur]-good.price)}`,()=>{
            const r=store.buyGood(good.id);
            if(r.ok&&(good.give.srPick||good.give.ssrPick))shopPickRarity=good.give.ssrPick?4:3;
            ctx.tell(r,`购得 ${good.name}`);
          });
        });
      });
      V.text('ShopTip','满星后的同名卡可兑换碎片；关闭自选窗口不会消耗自选券。',0,cursor-goods.length*101-25,645,16,tone('#ad9977'));
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
      U.scroll('ShopPickGrid',0,-19,622,804,gridH,(V)=>{ // D3：视口底缘与暂不选择按钮让出 5px 间隙（原 811 相切裁卡）
        list.forEach((hero:any,i:number)=>{
          const x=-206+i%3*206,y=gridH/2-94-Math.floor(i/3)*ch;
          V.panel('ShopPickCard'+i,x,y,185,177,tone('#322319'),8,rarity===4?GOLD:tone('#795b34'));
          V.heroIcon('ShopPickPortrait'+i,x,y+32,149,89,{surname:hero.surname||hero.name[0],faction:hero.faction,rarity:hero.rarity,artKey:hero.id});
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
  U.backBar(()=>ctx.back('campaign'), '‹ 返回', 609);
  U.panel('FormationSummary',0,514,682,112,tone('#342518'),11,GOLD);
  U.text('FormationSummaryTitle','出征编队',-204,549,260,28,GOLD);
  U.text('FormationPower',`总战力 ${fmt.fmtNum(store.teamPower())}`,-202,514,270,25,GOLD);
  U.text('FormationFaction',bonus.atk>0?`同阵营 ×${bonus.atk>=.18?5:bonus.atk>=.12?4:3}：攻击/生命 +${Math.round(bonus.atk*100)}%`:'同阵营 3/4/5 人激活全队加成',-181,478,355,18,tone('#ad9977'));
  // 队伍总览一行（研讨会八方案 7）：军械+羁绊一目了然
  const bondCount=store.activeBonds().length;
  const ab=store.getArmoryBonuses();
  const overviewText=[`军械 攻+${Math.round(ab.atk*100)}%/体+${Math.round(ab.hp*100)}%`,`羁绊 ${bondCount}/8`].join(' · ');
  U.text('FormationOverview',overviewText,190,478,290,17,GOLD);
  U.button('FormationRecommend','推荐布阵',244,514,170,55,()=>{
    const stage2=store.getState().campaign.cleared+1;
    const fCount2:any={};
    stages.makeStageEnemies(stage2).units.forEach((u2:any)=>{if(u2.hero)fCount2[u2.hero.faction]=(fCount2[u2.hero.faction]||0)+1;});
    const dom2=Object.keys(fCount2).sort((a2:string,b2:string)=>fCount2[b2]-fCount2[a2])[0]||null;
    formationRecommended=recommendFormation(store.allRoster(),dom2||undefined);
    ctx.show('formation');
  },palette.gold);
  U.text('FormationBackLabel','后 排（远程输出 / 辅助）',0,444,540,19,tone('#ad9977'));
  U.text('FormationFrontLabel','前 排（承伤 / 近战）',0,230,540,19,tone('#ad9977'));
  U.line('FormationDivider',[[-250,252],[250,252]],2,tone('#766349'));
  s.formation.forEach((id: string|null,i: number)=>{
    const x=i<3?-216+i*216:-108+(i-3)*216,y=i<3?138:350;
    const hero=id?heroes.getHero(id):null;
    U.panel('Slot'+i,x,y,188,164,tone('#322319'),9,id?GOLD:tone('#827563'));
    U.heroIcon('SlotAvatar'+i,x,y+22,145,100,hero?{surname:hero.surname||hero.name[0],faction:hero.faction,rarity:hero.rarity,artKey:hero.id}:{surname:'+'});
    U.text('SlotName'+i,hero?.name||'点击上阵',x,y-47,165,21,GOLD);
    U.text('SlotLevel'+i,hero?`Lv.${store.playerLevel()}`:'',x,y-69,150,16,tone('#ad9977'));
    U.tap('SlotTap'+i,x,y,188,164,()=>{ctx.selectedFormationSlot=i;ctx.go('formationPick');});
  });
  U.text('FormationHelp1','点击已上阵武将可更换；阵营克制：魏→蜀→吴→群→魏',0,44,650,18,tone('#ad9977'));
  U.text('FormationHelp2','克制方伤害 +25% · 索敌：同排按 1→3 号位承伤 · 神射直取后排 · 军师随机',0,20,668,15,tone('#8a9a7a'));
  const pi=store.formationPresetsInfo();
    U.panel('PresetBand',0,-30,682,40,tone('#2e2113'),7,tone('#795b34'));
    pi.list.forEach((pm:any,i:number)=>{
      const x=-244+i*160;
      const active=s.formation.join()===pm.slots.join();
      U.panel('PresetChip'+i,x,-30,146,30,active?tone('#45321b'):tone('#171009'),6,active?GOLD:tone('#5a452a'));
      U.text('PresetChipTxt'+i,pm.name+(active?' ✓':''),x,-30,138,16,active?GOLD:LIGHT);
      if(!active)U.tap('PresetTap'+i,x,-30,146,30,()=>ctx.tell(store.applyFormationPreset(pm.key),'已启用模板：'+pm.name));
      U.text('PresetDelX'+i,'×',x+64,-27,16,13,tone('#bb614c'));
      U.tap('PresetDelTap'+i,x+55,-27,18,24,()=>ctx.confirm('删除模板','删除「'+pm.name+'」？不可恢复',()=>{const r=store.delFormationPreset(pm.key);ctx.tell(r,r.ok?'模板已删除':'');}));
    });
    if(pi.count<pi.max){
      const sx=-244+pi.list.length*160;
      U.panel('PresetSaveChip',sx,-30,146,30,tone('#39291a'),6,GOLD);
      U.text('PresetSaveTxt','保存当前阵容',sx,-30,138,15,GOLD);
      U.tap('PresetSaveTap',sx,-30,146,30,()=>ctx.confirm('保存阵型模板','把当前五人编队存为模板（含站位），日后一键启用',()=>{const r=store.saveFormationPreset('p'+(Date.now()%100000),'我的阵型');ctx.tell(r,r.ok?'模板已保存':'');}));
    }
  const bondsNow=store.activeBonds(),allBonds=heroes.BONDS||[],mods=store.bondMods();
  // 义从·本周三席（同袍录 Phase A）：三席展示每日 3 选 1，作第 6 人上阵（仅 PVE）
  const bb=store.borrowInfo();
  if(bb.enabled){
    U.panel('BorrowBanner',0,-510,682,48,tone('#26301f'),8,bb.active?tone('#6f8a5f'):GOLD);
    U.text('BorrowTitle','义从三席',-292,-510,96,18,GOLD);
    const seats=(bb.seats||[]).slice(0,3);
    seats.forEach((hid:string,i:number)=>{
      const sx=-160+i*164;
      const isBorrowed=bb.active===hid;
      const hname=(heroes.getHero(hid)?.name||hid)+' Lv.'+bb.level;
      if(isBorrowed){
        U.panel('BorrowChip'+i,sx,-510,156,36,tone('#3a2c17'),7,GOLD);
        U.text('BorrowChipTxt'+i,`${heroes.getHero(hid)?.name||hid}·义 随军`,sx,-510,150,16,GOLD);
        U.tap('BorrowChipTap'+i,sx,-510,156,36,()=>ctx.confirm('撤下义从','撤下后今日仍可改借其他席位（同一日仅一名随军）',()=>{const r=store.dismissBorrow();ctx.tell(r,r.ok?'义从已撤下':'');}));
      }else if(bb.usedToday){
        U.panel('BorrowChip'+i,sx,-510,156,36,tone('#171009'),7,tone('#5a452a'));
        U.text('BorrowChipTxt'+i,`${heroes.getHero(hid)?.name||hid}（明日）`,sx,-510,150,16,tone('#7a6c52'));
      }else{
        U.panel('BorrowChip'+i,sx,-510,156,36,tone('#39291a'),7,GOLD);
        U.text('BorrowChipTxt'+i,hname,sx,-510,150,16,LIGHT);
        U.tap('BorrowChipTap'+i,sx,-510,156,36,()=>{const r=store.borrowHero(hid);ctx.tell(r,r.ok?`${heroes.getHero(hid)?.name||hid}·义 已随军（第 6 人，仅 PVE）`:'');if(r.ok)ctx.show('formation');});
      }
    });
    // 传檄小按钮（同袍录 Phase A）
    const ciX=344-64;
    U.text('CompanionSent','传檄 >',296,-510,60,16,GOLD);
    U.tap('CompanionSentTap',296,-510,64,44,()=>{
      const ci=store.companionInfo();
      const vanguard=(s.formation||[]).slice(0,2).map((id:string)=>heroes.getHero(id)?.name||id).join('、')||'众将';
      const cleared=s.campaign.cleared||0;
      ctx.shareResult(`讨伐檄文 · 已克 ${cleared} 关 · ${vanguard}为先驱，邀同袍共讨国贼`,'t=xw&c='+ci.code+'&s='+cleared);
      store.companionMarkSent();
    });
  }
  U.panel('BondsPanel',0,-266,682,420,tone('#342518'),11,GOLD);
  U.text('BondsTitle',`三国羁绊 · 已激活 ${bondsNow.length}/${allBonds.length}`,-160,-70,400,24,GOLD);
  const modLabel:any={atk:'攻击',hp:'生命',def:'防御'};
  const modText=['atk','hp','def'].map((k:string)=>mods[k]?`${modLabel[k]}+${Math.round(mods[k]*100)}%`:'').filter(Boolean).join(' · ');
  U.text('BondsEffect',modText||'—',190,-70,270,20,GOLD);
  U.text('BondsHint','组合内武将同时上阵即全军生效',-180,-98,420,16,tone('#ad9977'));
  allBonds.forEach((b:any,i:number)=>{
    const y=-132-i*40;
    const active=bondsNow.some((x:any)=>x.id===b.id);
    U.text('BondName'+i,(active?'● ':'○ ')+b.name,-232,y,170,19,active?GOLD:tone('#a99778'));
    U.text('BondMembers'+i,b.heroes.map((hid:string)=>heroes.getHero(hid)?.name||hid).join('·'),-70,y,330,17,LIGHT);
    const missing=(b.heroes||[]).filter((hid:string)=>!s.roster[hid]);
    U.text('BondState'+i,active?'已激活':missing.length?`缺 ${missing.map((hid:string)=>heroes.getHero(hid)?.name||hid).join('')}`:'未上阵',215,y,180,17,active?GOLD:tone('#a99778'));
  });
  const comboLine=bondsNow.filter((b:any)=>b.combo).map((b:any)=>`${b.combo.name}·${b.combo.short}`).join('　');
  U.text('BondsCombo',comboLine?`组合技：${comboLine}`:'组合技：凑齐组合后额外生效（如五虎破军·全军暴伤+15%）',0,-438,640,16,comboLine?GOLD:tone('#ad9977'));
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
  firstTimeOverlay(ctx,'borrow'); // 移至末尾：晚于羁绊面板注册，遮罩置顶（体验官 P2 修复）
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
      V.heroIcon('PickFace'+i,x,y+39,155,97,{surname:hero.surname||hero.name[0],faction:hero.faction,rarity:hero.rarity,artKey:hero.id});
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
    if(!list.length){
      V.text('PickEmptyText','当前可用武将都已上阵',0,contentH/2-100,525,22,tone('#ad9977'));
      V.button('PickSummon','前往召唤',0,contentH/2-174,260,54,()=>ctx.go('summon'),tone('#806136'));
    }
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
    U.text('ArenaFormation','调整编队 >',222,302,198,18,tone('#ad9977'));
    U.tap('ArenaFormationTap',218,328,228,104,()=>ctx.go('formation'));
    // 赛季条（2026-09-30 裁决 A）：本周段位 + 周段位奖进度 + 软重置预览，点击进演武榜
    const season=store.arenaSeasonInfo();
    U.panel('ArenaSeason',0,237,682,62,tone('#26301f'),9,tone('#6f8a5f'));
    U.text('ArenaSeasonMain',`本周 ${season.rank} · ${season.points} 分`,-168,250,330,22,GOLD);
    U.text('ArenaSeasonSub',`周段位奖 ${season.claimedCount}/${season.tiers.length} · 下周一重置至约 ${season.carryPreview} 分`,-131,225,400,16,tone('#ad9977'));
    U.text('ArenaSeasonGo','榜单 >',255,250,120,22,GOLD);
    U.tap('ArenaSeasonTap',0,237,682,62,()=>ctx.go('arenaBoard'));
    const date=new Date(),day=date.getFullYear()*10000+(date.getMonth()+1)*100+date.getDate();
    [
      {diff:.8,name:'守碉老卒·1号'},
      {diff:1.05,name:'游历侠客·2号'},
      {diff:1.35,name:'无名猛将·3号'}
    ].forEach((o,i)=>{
      const y=134-i*142,enemy=stages.makeArenaEnemies(store.teamPower(),day*97+i*13,o.diff);
      const power=Math.floor(enemy.units.reduce((sum:number,unit:any)=>sum+heroes.heroPower(unit.hero,unit.level,unit.star),0)*(o.diff>1?o.diff*.98:o.diff));
      U.panel('Arena'+i,0,y,682,126,tone('#312218'),9,o.diff>1.2?GOLD:tone('#8c6a3a'));
      U.text('ArenaEnemy'+i,o.name,-155,y+43,330,24,GOLD);
      U.text('ArenaDifficulty'+i,o.diff>1.2?'凶险':'寻常',267,y+32,115,18,o.diff>1.2?palette.red:tone('#ad9977'));
      U.text('ArenaEnemyPower'+i,`Lv.${enemy.units[0].level} · ${fmt.fmtNum(power)}` ,80,y-42,150,18,tone('#d8c69f'));
      const fCountA:any={};
      enemy.units.forEach((unit:any)=>{fCountA[unit.hero.faction]=(fCountA[unit.hero.faction]||0)+1;});
      const domA=Object.keys(fCountA).sort((a:string,b:string)=>fCountA[b]-fCountA[a])[0];
      const domNameA=(config.FACTIONS as any)[domA]?.name||'';
      const counterA=Object.keys(config.BEATS).find((k:any)=>(config.BEATS as any)[k]===domA);
      U.text('ArenaFaction'+i,`${domNameA}×${fCountA[domA]} · ${counterA?(config.FACTIONS as any)[counterA]?.name:''}克`,80,y-20,150,17,tone('#ad9977'));
      enemy.units.slice(0,5).forEach((unit:any,j:number)=>{
        const hero=unit.hero, captain=j===0, x=captain?-232:-158+(j-1)*43;
        U.heroIcon(`ArenaEnemyFace${i}_${j}`,x,y+(captain?-1:-5),captain?52:34,captain?60:41,{surname:hero?.name?.slice(0,1)||unit.name?.slice(0,1)||'兵',faction:hero?.faction||unit.faction,rarity:hero?.rarity||1,artKey:hero?.id||unit.heroId});
      });
      U.text('ArenaCaptain'+i,'主将',-232,y-43,66,15,GOLD);
      U.button('ArenaFight'+i,'切 磋',244,y-20,174,54,()=>ctx.startArenaBattle(o.diff,day*97+i*13),palette.red);
    });
    U.text('ArenaRule1','赛季每周一刷新 · 积分保留 50% · 周段位奖按本周最高发放',0,-252,660,18,LIGHT);
    U.text('ArenaRule2','演武令可在集市兑换招募令与自选卡',0,-276,660,18,tone('#ad9977'));
    U.button('ArenaBack','返 回',0,-481,295,59,()=>ctx.back('journey'),palette.paperDark);
  }

// 演武榜（2026-09-30 裁决 A）：周段位奖里程碑 + 本地假人榜（同周内稳定）
export function arenaBoard(ctx: ScreenContext) {
    const U=ctx.ui,season=store.arenaSeasonInfo(),board=store.arenaBoardInfo();
    ctx.title('演 武 榜');
    U.panel('BoardMe',0,428,682,74,tone('#3a2c17'),10,GOLD);
    U.text('BoardMeMain',`第 ${board.myRank} 名 · ${season.points} 分 · ${season.rank}`,-152,450,460,24,GOLD);
    U.text('BoardMeSub',`本周共 ${board.rows.length} 名 · 下周一重置至约 ${season.carryPreview} 分`,-152,424,460,17,tone('#ad9977'));
    U.text('BoardTierTitle','周段位奖（按本周最高段位一次性发放）',0,376,620,17,LIGHT);
    const REWARD_NAME:any={gold:'铜钱',gem:'元宝',token:'演武令',seals:'印信'};
    season.tiers.forEach((t:any,i:number)=>{
      const x=-272+i*136;
      U.panel('BoardTier'+i,x,318,126,64,t.reached?tone('#4a3a17'):tone('#26201a'),8,t.reached?GOLD:tone('#4f4230'));
      U.text('BoardTierName'+i,t.name,x,334,116,18,t.reached?GOLD:tone('#ad9977'));
      U.text('BoardTierReward'+i,Object.keys(t.bonus).map((k:string)=>{const n=(t.bonus as any)[k];const nm=({gold:'铜',gem:'宝',token:'令',seals:'印'} as any)[k]||(REWARD_NAME as any)[k]||k;return `${nm}${n>=10000?(n/10000)+'万':n}`;}).join('·'),x,308,116,15,t.reached?LIGHT:tone('#7a6c52'));
    });
    U.scroll('ArenaBoardList',0,-100,682,720,board.rows.length*52+16,V=>{
      board.rows.forEach((r:any,i:number)=>{
        const y=(board.rows.length*52)/2-26-i*52;
        V.panel('BoardRow'+i,0,y,672,46,r.me?tone('#4a3a17'):tone('#241b12'),7,r.me?GOLD:tone('#3f3424'));
        V.text('BoardRank'+i,r.rank<=3?['🥇','🥈','🥉'][r.rank-1]:`#${r.rank}`,-290,y,72,20,r.me?GOLD:LIGHT);
        V.text('BoardName'+i,r.name,-160,y,240,20,r.me?GOLD:LIGHT);
        V.text('BoardPts'+i,`${r.points} 分`,200,y,180,19,r.me?GOLD:tone('#ad9977'));
      });
    });
    U.text('BoardHint','榜单为本地演武指引，每周随赛季刷新',0,-490,600,16,tone('#7a6c52'));
    U.button('BoardBack','返 回',0,-528,295,52,()=>ctx.go('arena'),palette.paperDark);
  }

/** 打字机（剧情推图衔接批次三）：挂在文本节点上随引擎每帧驱动（帧率无关），
 *  点按可立即补完（对齐「点击推进」语义）；随节点销毁自动清理，无遗留计时器。 */
class StoryTyper extends Component {
  private full = '';
  private label: Label | null = null;
  private elapsed = 0;
  private shown = -1;
  public done = true;
  public cps = 50; // 约 0.02s/字（方案批次三 ②）
  static attach(node: Node, full: string, cps: number) {
    const typer = node.addComponent(StoryTyper);
    typer.full = full;
    typer.label = node.getComponent(Label);
    typer.cps = cps;
    typer.done = false;
    if (typer.label) typer.label.string = '';
    return typer;
  }
  update(dt: number) {
    if (this.done || !this.label || !this.isValid) return;
    this.elapsed += dt;
    const n = Math.min(this.full.length, Math.floor(this.elapsed * this.cps));
    if (n !== this.shown) { this.shown = n; this.label.string = this.full.slice(0, n); }
    if (n >= this.full.length) this.done = true;
  }
  /** 点按补完：立即显示全文。 */
  finish() {
    if (this.done) return;
    this.done = true;
    if (this.label) this.label.string = this.full;
  }
}

// 剧情页播放状态（批次三）：段位推进跨 ctx.show 重渲染保留；换关/换模式重置
let storySegIdx = 0;
let storySegKey = '';
let storyTyper: StoryTyper | null = null;

// 剧情页（批次四段化重构）：段序列 = [BOSS 开场白]（名将关，立绘+双横幅）→ [章节引子]（新章首关）
// → 旁白 → 对白逐段。打字机+点击推进贯穿全部段；乱世合成章无过场数据，自然回落原两段形态。
export function storyView(ctx: ScreenContext) {
    const st=stages.makeStageEnemies(ctx.storyStage).story;
    const U=ctx.ui;
    const narration=st?.stage.narration || '两军列阵，战鼓已鸣。';
    const dialogue=((st?.stage as any)?.dialogue || []) as Array<{who:string;text:string}>;
    const trans=story.getChapterTransition(ctx.storyStage);
    const bossIntroRows=(st&&st.isBoss&&!(st as any).synthetic?(((st.ch as any)?.bossIntro||[]) as Array<{text:string;sub:string}>):[]);
    type StorySeg={kind:'boss'|'intro'|'narr'|'line';text?:string;line?:{who:string;text:string}};
    const segs:StorySeg[]=[];
    if(bossIntroRows.length)segs.push({kind:'boss'});
    if(trans&&trans.kind==='intro'&&trans.text)segs.push({kind:'intro',text:trans.text});
    segs.push({kind:'narr',text:narration});
    dialogue.forEach(l=>segs.push({kind:'line',line:l}));
    const total=segs.length;
    const segKey=`${ctx.storyStage}:${ctx.storyReview?'r':'p'}`;
    if(storySegKey!==segKey){storySegKey=segKey;storySegIdx=0;}
    if(storySegIdx>total-1)storySegIdx=total-1;
    const seg=segs[storySegIdx];
    const isLast=storySegIdx>=total-1;
    const advance=()=>{
      if(storyTyper&&storyTyper.isValid&&!storyTyper.done){storyTyper.finish();return;}
      if(storySegIdx<total-1){storySegIdx++;ctx.show('story');}
    };
    U.rect('StoryBackdrop',0,0,720,1280,tone('#20160e'));
    U.text('StoryChapter',st?.ch.name || '乱世纷争',0,535,645,39,GOLD);
    U.text('StoryStage',st?.stage.name || `第 ${ctx.storyStage} 关`,0,479,640,23,tone('#a99778'));
    U.panel('StoryPaper',0,64,654,708,tone('#e6d7b3'),12,tone('#a8834f'));
    if(seg.kind==='boss'){
      // BOSS 开场白段（批次四 ①，ch01–08 存量数据上线、09–16 新补）：主将立绘 + 双横幅开场白
      const bossId=((st?.stage as any)?.foes||[])[0] as string|undefined;
      const bossHero=bossId?heroes.getHero(bossId):null;
      U.text('StoryBossTag','— 名 将 登 场 —',0,384,320,17,tone('#8a7c5f'));
      U.heroIcon('StoryBossFace',0,262,132,176,{
        surname:bossHero?.name?.slice(0,1)||'？',faction:bossHero?.faction,rarity:bossHero?.rarity||1,
        artKey:bossId||undefined
      });
      U.text('StoryBossName',bossHero?`${bossHero.name}${bossHero.title?' · '+bossHero.title:''}`:'未知名将',0,148,480,24,tone('#6b4f2a'));
      bossIntroRows.slice(0,2).forEach((b,i)=>{
        const y=44-i*108;
        U.panel('StoryBossBanner'+i,0,y,600,80,tone('#2c1f12'),9,tone('#a8834f'));
        if(i===0){
          const bNode=U.text('StoryBossText0','',0,y+16,560,26,GOLD);
          storyTyper=StoryTyper.attach(bNode,b.text,40);
        } else U.text('StoryBossText1',b.text,0,y+16,560,26,GOLD);
        U.text('StoryBossSub'+i,b.sub||'',0,y-18,560,16,tone('#a99778'));
      });
    } else {
      // 已演过内容的顶部回显：对白段收旁白为引文（批次三形态）；旁白段收章节引子为引文（批次四）
      if(seg.kind==='line')U.textBlock('StoryNarration',narration,0,330,564,96,21,tone('#6e6350'));
      else if(seg.kind==='narr'&&storySegIdx>0&&trans&&trans.kind==='intro'&&trans.text)
        U.textBlock('StoryIntroQuote',trans.text,0,330,564,44,17,tone('#c9b489'));
      if(seg.kind==='narr'||seg.kind==='intro'){
        // 旁白/章节引子：大字打字机逐字浮现（批次三 ② 形态复用）
        const nNode=U.textBlock('StoryNarration','',0,150,564,200,26,INK);
        storyTyper=StoryTyper.attach(nNode,seg.kind==='intro'?(seg.text||''):narration,50);
      }
      if(seg.kind==='line'){
        // 对白卡（一次一段）：说话人立绘头像（ArtService 分包立绘，无图回退姓氏印章）+ 打字机台词
        const line=seg.line!;
        const hero=line.who?heroes.getHero(line.who):null;
        const speakerName=hero?.name||line.who||'？';
        U.panel('StoryDialogue',0,120,585,240,tone('#d6c49e'),9,tone('#a8834f'));
        U.heroIcon('StoryFace',-208,122,132,176,{
          surname:speakerName.slice(0,1),faction:hero?.faction,rarity:hero?.rarity||1,
          artKey:hero?line.who:undefined
        });
        U.text('StorySpeaker',speakerName,78,206,400,21,tone('#6b4f2a'));
        const lNode=U.textBlock('StoryLine','',78,110,410,140,23,INK);
        storyTyper=StoryTyper.attach(lNode,line.text,50);
      }
    }
    if(!isLast)U.text('StoryHint','▼ 点击继续',0,-244,300,18,tone('#8a7c5f'));
    // 点击推进热区：盖住羊皮纸区；底部按钮后绘制、热区不重叠
    U.tap('StoryAdvance',0,64,654,708,advance);
    if(ctx.storyReview){
      // 剧情回顾模式（用户指令 2026-10-01：剧情交互友好化）：只读回看，不进战斗
      U.text('StoryReviewTag','剧 情 回 顾 · 只读',0,-360,400,17,tone('#a99778'));
      U.panel('StoryFight',0,-420,460,78,tone('#3a2b20'),9,GOLD);
      U.text('StoryFightText','返回剧情回顾',0,-420,438,27,LIGHT);
      U.tap('StoryFightTap',0,-420,460,78,()=>{ctx.storyReview=false;ctx.go('storyArchive');});
    } else if(ctx.auto){
      // 自动出征剧情暂停（批次一）：ctx.auto 在剧情页上仅见于自动暂停点（手动进剧情页会被
      // startBattle 的 auto 拦截确认）。看完/跳过都恢复连战；不提供「返回关卡预览」出口，
      // 防止自动会话悬停在剧情页；重复点击由 finishAutoStory 的状态守卫兜底
      // 「跳过 · 继续连战」常驻（批次一契约：跳过必须随时可达）；「看完开战」仅末段出现（批次三）
      if(isLast){
        U.panel('StoryFight',0,-392,460,78,palette.red,9,GOLD);
        U.text('StoryFightText','看完开战 · 继续出征',0,-392,438,27,LIGHT);
        U.tap('StoryFightTap',0,-392,460,78,()=>ctx.finishAutoStory());
      }
      U.panel('StorySkip',0,-482,460,64,tone('#3d6653'),9,GOLD);
      U.text('StorySkipText','跳过 · 继续连战',0,-482,438,24,LIGHT);
      U.tap('StorySkipTap',0,-482,460,64,()=>ctx.finishAutoStory());
    } else {
      // 手动模式：末段显示「开战」；前段同位显示「跳过剧情」直进战斗（P1：演出必须可跳过）
      // 已读语义（批次五②）：markStorySeen 只在此处（玩家实际看到末段或主动跳过）与
      // CocosBootstrap.finishAutoStory（自动暂停看完/跳过）两处写入——全工程无其他写点
      U.panel('StoryFight',0,-392,460,78,palette.red,9,GOLD);
      U.text('StoryFightText',isLast?'开  战':'跳过剧情 »',0,-392,438,27,LIGHT);
      U.tap('StoryFightTap',0,-392,460,78,()=>{
        store.markStorySeen(ctx.storyStage); store.save(); ctx.startBattle('campaign',ctx.storyStage);
      });
      U.text('StoryBackText','返回关卡预览',0,-482,318,20,GOLD);
      U.tap('StoryBackTap',0,-482,318,45,()=>ctx.back('stagePreview'));
    }
  }

// 章末过场页（批次四 ②）：首通一章末关（第 10/20/…/160 关）后的章末回顾——
// 章名 + finale 打字机 + 「继续进军」；点击推进（补完打字机）。复用剧情页演出形态；
// 自动模式不进此页（结算页 1.5s 掠过横幅，不打断连战，见 BattleScreens.resultView）。
// 章节推导自 campaign.cleared（方案约束：存档不加字段）。
export function storyTransitionView(ctx: ScreenContext) {
  const U=ctx.ui,s=store.getState();
  const cleared=s.campaign.cleared||0;
  const chIdx=Math.min(stages.CHAPTERS.length-1,Math.max(0,Math.floor((cleared-1)/10)));
  const trans=story.getChapterTransition(cleared);
  const finText=trans&&trans.kind==='finale'&&trans.text?trans.text
    :((story.CHAPTERS as any[])[chIdx]?.finale||'乱世征途，仍在继续。');
  U.rect('StoryBackdrop',0,0,720,1280,tone('#20160e'));
  U.text('StoryChapter',stages.chapterOf(chIdx*10+1).name,0,535,645,39,GOLD);
  U.text('StoryStage','章 末 回 顾',0,479,640,23,tone('#a99778'));
  U.panel('StoryPaper',0,64,654,708,tone('#e6d7b3'),12,tone('#a8834f'));
  U.text('StoryFinaleTag','— 本 章 终 —',0,384,320,17,tone('#8a7c5f'));
  const fNode=U.textBlock('StoryFinale','',0,40,564,240,26,INK);
  storyTyper=StoryTyper.attach(fNode,finText,40);
  U.tap('StoryAdvance',0,64,654,708,()=>{
    if(storyTyper&&storyTyper.isValid&&!storyTyper.done)storyTyper.finish();
  });
  U.panel('StoryFight',0,-392,460,78,palette.red,9,GOLD);
  U.text('StoryFightText','继续进军 »',0,-392,438,27,LIGHT);
  U.tap('StoryFightTap',0,-392,460,78,()=>ctx.startBattle('campaign',cleared+1));
  U.text('StoryBackText','返回战役',0,-482,318,20,GOLD);
  U.tap('StoryBackTap',0,-482,318,45,()=>ctx.go('campaign'));
}

export function storyArchiveView(ctx: ScreenContext) {
  const U=ctx.ui,s=store.getState();
  const cleared=s.campaign.cleared||0;
  const maxCh=Math.min(15,Math.floor(cleared/10));
  const chIdx=Math.min(Math.max(0,ctx.storyArchiveCh||0),maxCh);
  ctx.storyArchiveCh=chIdx;
  ctx.title('剧 情 回 顾');
  U.backBar(()=>ctx.go('campaign'));
  U.panel('ArcChPanel',0,392,640,126,tone('#312218'),9,GOLD);
  U.button('ArcPrev','‹',-268,412,84,52,()=>{ctx.storyArchiveCh=Math.max(0,chIdx-1);ctx.show('storyArchive');},chIdx>0?tone('#5a452a'):tone('#332a1e'));
  U.button('ArcNext','>',268,412,84,52,()=>{ctx.storyArchiveCh=Math.min(maxCh,chIdx+1);ctx.show('storyArchive');},chIdx<maxCh?tone('#5a452a'):tone('#332a1e'));
  const chName=stages.chapterOf(chIdx*10+1).name;
  let seenCount=0;
  for(let i=0;i<10;i++)if(store.isStorySeen(chIdx*10+i+1))seenCount++;
  U.text('ArcChName',chName,0,438,420,26,GOLD);
  U.text('ArcChSub',`已读 ${seenCount}/10 · 点击已解锁关回看剧情`,0,410,420,16,tone('#ad9977'));
  // 章叙事（用户指令延伸：intro/finale 此前全 UI 零引用）
  const chDef=(story.CHAPTERS as any[])[chIdx];
  const chapterDone=cleared>=chIdx*10+10;
  if(chDef){
    U.text('ArcNarrTag',chapterDone?'章末 · 全书回顾':'本章 · 开篇叙事',0,384,420,14,tone('#8a7c5f'));
    U.textBlock('ArcNarr',chapterDone?chDef.finale:chDef.intro,0,358,600,44,17,tone('#c9b489'));
  }
  U.scroll('ArcList',0,-102,682,826,10*68+20,V=>{
    for(let i=0;i<10;i++){
      const n=chIdx*10+i+1;
      const st=stages.makeStageEnemies(n).story;
      const seen=store.isStorySeen(n);
      const open=n<=cleared+1;
      const y=(10*68+20)/2-34-i*68;
      V.panel('ArcRow'+i,0,y,660,58,seen?tone('#2b2418'):tone('#1d1812'),7,seen?tone('#795b34'):tone('#3a2f20'));
      V.text('ArcRowNum'+i,String(n).padStart(2,'0'),-282,y,60,22,seen?GOLD:tone('#7a6c52'));
      V.text('ArcRowName'+i,st?.stage?.name||'—',-160,y,344,22,open?LIGHT:tone('#7a6c52'));
      V.text('ArcRowState'+i,seen?'已读 · 回顾 >':open?'未读,可阅':'未开放',225,y,150,17,seen?GOLD:open?tone('#a99778'):tone('#6b5837'));
      if(open)V.tap('ArcRowTap'+i,0,y,660,58,()=>{
        ctx.storyStage=n;ctx.storyReview=true;ctx.go('story');
      });
    }
  });
  U.button('ArcBackBtn','返 回',0,-510,295,52,()=>ctx.go('campaign'),palette.paperDark);
}

const SEVEN_DAY_CN = ['一', '二', '三', '四', '五', '六', '七'];

export function hallView(ctx: ScreenContext) {
  const U=ctx.ui,hi=store.hallInfo(),st=store.getState();
  ctx.title('名 人 堂');
  U.backBar(()=>ctx.go('journey'));
  U.text('HallWeek',`本周名阵容 · 荣耀 ${hi.honor}`,-160,443,420,20,GOLD);
  hi.titles.forEach((t:any,i:number)=>{
    U.text('HallTitle'+i,(t.owned?'「':'')+t.title+(t.owned?'」':'')+' '+t.honor+'荣耀',-140+i*210,415,205,17,t.owned?GOLD:tone('#a6906c'));
  });
  hi.seats.forEach((x:any,i:number)=>{
    const y=340-i*118;
    const members=(heroes.HEROES as any);
    const names=x.members.map((id:string)=>members.find((m:any)=>m.id===id)?.name||id).join('·');
    U.panel('HallSeat'+i,0,y,640,104,x.killed?tone('#26301f'):tone('#312218'),9,x.killed?tone('#6f8a5f'):tone('#a17b40'));
    U.text('HallSeatName'+i,['一席','二席','三席'][x.seat]+' · '+x.name,-170,y+22,420,24,GOLD);
    U.text('HallSeatMembers'+i,names,-170,y-10,420,16,LIGHT);
    if(x.trait)U.text('HallSeatTrait'+i,'主将特质：'+x.trait,-170,y-34,420,14,tone('#d9b06a'));
    if(x.killed){
      U.text('HallState'+i,`已胜 ★${x.stars} · 重复挑战可刷评星`,180,y+24,340,17,tone('#6f8a5f'));
    } else {
      U.button('HallFight'+i,'挑 战',230,y+14,170,52,()=>ctx.startBattle('hall',x.seat),palette.red);
    }
  });
  const rp=store.replaysInfo();
  if(rp.list.length){
    U.text('HallReplayTitle',`战报 · 最近 ${rp.list.length} 场（滚动）`,0,-40,640,18,GOLD);
    U.scroll('HallReplayList',0,-284,652,440,rp.list.length*58+16,(V)=>{
      rp.list.forEach((r:any,i:number)=>{
        const y=(rp.list.length*58+16)/2-29-i*58;
        const shortName=(r.name||'').replace(/^第[一二三四五六七八九十百]+章 · /,'');
        const label=r.mode==='campaign'?`${shortName}${r.first?' · 首通':''}${r.stars?' ★'+r.stars:''}`
          :r.mode==='tower'?`群英塔 第 ${(r.index||0)} 层${r.win?' ✓':''}`
          :r.mode==='arena'?'演武 · 凶险切磋'
          :`名人堂 · ${r.name||`第 ${((r.seat||0)+1)} 席`}${r.stars?' ★'+r.stars:''}`;
        V.panel('HallReplay'+i,0,y,640,50,tone('#171009'),6,tone('#5a452a'));
        V.text('HallReplayTxt'+i,`${r.win?'胜':'负'} · ${label} · ${Math.round((r.duration||0)*10)/10} 秒`,-140,y,460,17,LIGHT);
        V.button('HallReplayGo'+i,'回 放',225,y,150,40,()=>ctx.startReplay(r),GOLD);
      });
    });
    firstTimeOverlay(ctx,'hall');
  }
}

export function expeditionView(ctx: ScreenContext) {
  const U=ctx.ui,w=store.weekInfo(),st=store.getState();
  ctx.title('远 征');
  U.backBar(()=>ctx.go('journey'));
  U.text('ExpWeek',`本周（${w.weekId}）· 印信 ${w.seals}`,0,443,640,20,GOLD);
  // 无限层词缀挑战（研讨会十二 A1：本周双词缀横幅，前 4 层免词缀）
  U.text('ExpTrialTitle','远征秘境 · 每周双词缀轮换，难度无上限',0,418,640,17,LIGHT);
  var bestFloor=(w.trial as any).best||0;
  var nextFloor=bestFloor+1;
  const mutCfg=(config as any).EXPEDITION_MUTATORS||{enabled:false,freeFloors:4};
  const mutIds:any[]=mutCfg.enabled?store.weekMutatorIds():[];
  const mutMeta=(config as any).CAMPAIGN_MODS.meta;
  const mutText=mutIds.length?mutIds.map((id:string)=>`${mutMeta[id].name}（${mutMeta[id].desc}）`).join(' · '):'';
  const boonPool=((config as any).EXPEDITION_BOONS||{}).pool||[];
  const curBoons=((w.trial as any).boons||[]).map((id:string)=>(boonPool.find((b:any)=>b.id===id)||{}).name||id);
  U.panel('ExpTrialCard',0,348,640,104,tone('#3a2c17'),8,GOLD);
  U.text('ExpTrialLabel','下一层 · 第 '+nextFloor+' 层',0,372,640,22,GOLD);
  var msList=(config.WEEKLY.trial as any).milestones||[];
  var reached=msList.filter(function(m){return bestFloor>=m.floor;}).length;
  U.text('ExpTrialBest',`已通 ${bestFloor} 层 · 里程碑 ${reached}/${msList.length}`,0,346,640,16,LIGHT);
  U.text('ExpTrialMut',bestFloor<mutCfg.freeFloors?`第 ${mutCfg.freeFloors} 层起生效：本周词缀 ${mutIds.map((id:string)=>mutMeta[id].name).join('·')}`:(mutText||'本周无词缀'),0,320,600,15,tone('#d9b06a'));
  U.button('ExpTrialGo','挑 战 第 '+nextFloor+' 层',0,262,500,56,function(){ctx.startBattle('expedition',nextFloor);},GOLD);
  // 加护行（局内 buff，周内累计）
  if(curBoons.length)U.text('ExpBoons',`加护（${curBoons.length}/${((config as any).EXPEDITION_BOONS||{}).maxStack||6}）：${curBoons.join('·')}`,0,214,640,16,GOLD);
  // 个人周报（研讨会十 D2）：本周战斗概要一行
  {
    const wr=store.weeklyReport();
    U.text('ExpWeekly','本周：胜 '+wr.wins+' 场 · 推图 +'+wr.stagesCleared+' · 塔 '+wr.towerBest+' 层 · 演武胜 '+wr.arenaWins,0,186,640,15,tone('#a99778'));
    if(wr.topHeroes.length)U.text('ExpWeeklyTop','常用：'+wr.topHeroes.join(' · '),0,166,640,14,tone('#8a7c5f'));
  }
  // 周活跃宝箱（试玩 P1 修补：规则侧已有 claimWeekActive，此前无 UI 入口）
  U.text('ExpActiveTitle','周活跃宝箱 · 按本周累计印信领印信与演武令',0,140,640,18,LIGHT);
  (w.active as any[]).forEach((a:any,i:number)=>{
    const x=-236+i*236;
    U.panel('ExpActive'+i,x,88,210,84,a.claimed?tone('#26301f'):a.claimable?tone('#3a2c17'):tone('#171009'),7,a.claimed?tone('#6f8a5f'):a.claimable?GOLD:tone('#5a452a'));
    U.text('ExpActiveNeed'+i,`累计印信 ${a.need}`,x,114,200,17,a.claimable?GOLD:LIGHT);
    U.text('ExpActiveReward'+i,'奖 '+Object.entries(a.reward).map(([k,n]:any)=>`${(store as any).CURRENCY_NAME[k]||k}×${n}`).join('·'),x,90,200,15,tone('#d9b06a'));
    U.button('ExpActiveGo'+i,a.claimed?'已 领':a.claimable?'领 取':`进度 ${w.sealsEarned}/${a.need}`,x,64,196,38,()=>{
      if(!a.claimable)return;
      const r=store.claimWeekActive(i);
      ctx.tell(r,r.ok?'活跃宝箱已领取':'');
    },a.claimable?GOLD:tone('#423022'));
  });
  // 周任务
  U.text('ExpQuestTitle','周任务 · 印信主要来源',0,24,640,18,LIGHT);
  w.quests.forEach((q:any,i:number)=>{
    const y=-22-i*56;
    U.panel('ExpQuest'+i,0,y,640,58,tone('#171009'),7,tone('#5a452a'));
    U.text('ExpQuestLabel'+i,q.label,-160,y+10,420,18,LIGHT);
    U.text('ExpQuestProg'+i,`${q.prog}/${q.target}`,70,y-16,110,15,tone('#a6906c'));
    U.button('ExpQuestGo'+i,q.claimed?'已领':q.claimable?'领印信':'未完成',235,y,150,46,()=>{
      if(!q.claimable)return;
      const r=store.claimWeekQuest(q.idx);
      ctx.tell(r,r.ok?`已领取 ${r.seals} 印信`:'');
    },q.claimable?GOLD:tone('#423022'));
  });
  // 印信兑换
  U.text('ExpShopTitle','印信兑换',0,-408,640,18,LIGHT);
  config.WEEKLY.shop.forEach((g:any,i:number)=>{
    const x=-230+(i%3)*230, y=-448-Math.floor(i/3)*62;
    const bought=g.weekly>0&&(st.week as any).shopBought[g.id];
    U.panel('ExpShopCard'+i,x,y,210,54,bought?tone('#171009'):tone('#3a2c17'),7,bought?tone('#5a452a'):GOLD);
    U.text('ExpShopName'+i,g.name,x,y+10,200,15,LIGHT);
    U.text('ExpShopCost'+i,`${g.seals} 印信`+(bought?' · 已兑':''),x,y-14,200,13,bought?tone('#6f8a5f'):tone('#d9b06a'));
    U.tap('ExpShopTap'+i,x,y,210,54,()=>{const r=store.buyWeekly(g.id);ctx.tell(r,r.ok?'兑换 '+r.name:'');});
  });
  // 加护三选一弹层（研讨会十二 A1）：每通 3 层出现，可稍后再选
  {
    const offer=store.expeditionBoonOffer();
    if(offer.length&&expBoonDismissedFloor!==bestFloor){
      U.rect('ExpBoonShade',0,0,720,1280,new Color(12,10,8,190));
      U.tap('ExpBoonShadeTap',0,0,720,1280,()=>{});
      U.panel('ExpBoonPanel',0,40,620,430,tone('#251b14'),12,GOLD);
      U.tap('ExpBoonBlock',0,40,620,430,()=>{});
      U.text('ExpBoonTitle','加 护 三 选 一',0,206,560,28,GOLD);
      U.text('ExpBoonSub','第 '+bestFloor+' 层通关嘉奖 · 加护仅本周远征生效，可叠 '+(((config as any).EXPEDITION_BOONS||{}).maxStack||6)+' 层',0,176,560,16,tone('#ad9977'));
      offer.forEach((b:any,i:number)=>{
        const y=96-i*88;
        U.panel('ExpBoonCard'+i,0,y,560,76,tone('#3a2c17'),9,GOLD);
        U.text('ExpBoonName'+i,b.name,-150,y+12,200,22,GOLD);
        U.text('ExpBoonDesc'+i,b.desc,60,y+10,320,17,LIGHT);
        U.tap('ExpBoonTap'+i,0,y,560,76,()=>{
          const r=store.pickExpeditionBoon(b.id);
          ctx.tell(r,r.ok?`已选加护「${r.boon}」：${r.desc}`:'');
          if(r.ok)ctx.show('expedition');
        });
      });
      U.button('ExpBoonLater','稍后再选',0,-134,300,50,()=>{expBoonDismissedFloor=bestFloor;ctx.show('expedition');},tone('#423022'));
    }
  }
  firstTimeOverlay(ctx,'expedition');
}


// 四方台 · 阵营试炼塔（研讨会十二 A2）：周轮换阵营，仅本国将可上阵
export function quadTowerView(ctx: ScreenContext) {
  const U=ctx.ui,qi=store.quadTowerInfo();
  ctx.title('四 方 台');
  U.backBar(()=>ctx.back('journey'));
  if(!qi.enabled){
    U.text('QuadClosed','四方台暂未开放',0,200,600,20,LIGHT);
    return;
  }
  const fname=(config.FACTIONS as any)[qi.faction]?.name||qi.faction;
  U.panel('QuadSummary',0,400,682,110,tone('#3a2c17'),10,GOLD);
  U.text('QuadTitle',`${fname} · ${qi.theme}`,-110,428,300,24,GOLD);
  U.text('QuadSub',`已登 ${qi.best}/${qi.floors} · 每日解锁 5 层 · 本国可战 ${qi.owned} 将`,-100,396,360,16,LIGHT);
  U.button('QuadGo',qi.best>=qi.floors?'本周已登顶':`挑 战 第 ${qi.best+1} 层`,244,400,172,60,()=>ctx.startBattle('quad',qi.best+1),qi.owned>0||qi.borrowUsable?GOLD:tone('#423022'));
  U.text('QuadBorrow',qi.borrowUsable?`本周义从含本国将 · 可带第 6 人`:`本周义从无${fname}将 · 不可带入`,0,316,640,16,qi.borrowUsable?GOLD:tone('#7a6c52'));
  U.text('QuadMile','5 层印信小奖 · 10 层大奖 · 15/30 层授称号',0,292,640,16,tone('#ad9977'));
  const reward=(f:number)=>{
    let txt=`铜钱 +${fmt.fmtNum(config.QUAD_TOWER.copper(f))}`;
    if(f%5===0)txt+=` · 印信 +${config.QUAD_TOWER.smallMilestone.seals}`;
    if(f%10===0)txt+=` · 铜钱 +${fmt.fmtNum(config.QUAD_TOWER.bigMilestone.gold)}`;
    if(config.QUAD_TOWER.titles[f])txt+=` · 称号「${config.QUAD_TOWER.titles[f]}」`;
    return txt;
  };
  const bossNameOf=(f:number)=>(config.QUAD_TOWER.bossPassives[f]&&config.QUAD_TOWER.bossPassives[f].name)||'';
  U.scroll('QuadList',0,-100,688,660,30*92+16,(V)=>{
    for(let f=1;f<=config.QUAD_TOWER.floors;f++){
      const cleared=f<=qi.best,current=f===qi.best+1,locked=f>qi.best+1;
      const y=(30*92+16)/2-40-(f-1)*92;
      V.panel('QuadFloor'+f,0,y,656,80,cleared?tone('#26301f'):current?tone('#3a2c17'):tone('#171009'),8,cleared?tone('#6f8a5f'):current?GOLD:tone('#5a452a'));
      V.text('QuadFloorNo'+f,`第 ${f} 层`,-246,y+14,140,20,cleared?tone('#a99778'):current?GOLD:LIGHT);
      const bossNm=bossNameOf(f);
      V.text('QuadFloorDesc'+f,current?(f%10===0?`名将层 · ${bossNm}`:'普通层'):'',-90,y+14,380,18,current?GOLD:cleared?tone('#a99778'):tone('#7a6c52'));
      V.text('QuadFloorReward'+f,current?reward(f):cleared?'已通关 · 可复打（无奖励）':locked&&f>qi.unlocked?`周第 ${Math.ceil(f/config.QUAD_TOWER.dailyUnlock)} 日解锁`:'未开放',-90,y-16,460,15,current?tone('#d9b06a'):cleared?tone('#a99778'):tone('#8a7c5f'));
      if(current)V.button('QuadFloorGo','出 战',244,y,172,56,()=>ctx.startBattle('quad',f),GOLD);
    }
  });
  U.text('QuadRule','仅本周阵营武将可上阵 · 败北无损失 · 周一换国',0,-510,640,16,tone('#7a6c52'));
  firstTimeOverlay(ctx,'quad');
}

// 四时战纪·赛季页（研讨会十三案一第一批）：卷幕/幕任务/卷志/军资簿/战功商店
export function seasonView(ctx: ScreenContext) {
  const U=ctx.ui,info=store.seasonInfo();
  ctx.title('四 时 战 纪');
  U.backBar(()=>ctx.back('journey'));
  if(!info.enabled){U.text('SeasonClosed','赛季休整中',0,200,600,20,LIGHT);return;}
  U.text('SeasonHead',`第${info.seasonNo}季 · 卷${info.vol}「${info.volName}」· ${info.actName} · 战功 ${info.medal}`,0,443,640,20,GOLD);
  // 卷志卡（本卷 2 页）
  U.panel('SeasonZhiCard',0,352,640,104,tone('#3a2c17'),8,GOLD);
  U.text('SeasonZhiTitle','卷志 · 本卷叙事（页一随卷解锁 · 页二幕任务全清）',0,394,600,18,LIGHT);
  U.text('SeasonZhiSub',' ',0,308,420,15,tone('#ad9977'));
  info.zhi.forEach((z:any,i:number)=>{
    const zx=i===0?-150:150;
    U.panel('SeasonZhiPg'+i,zx,348,190,64,z.unlocked?tone('#39291a'):tone('#171009'),7,z.unlocked?GOLD:tone('#5a452a'));
    U.text('SeasonZhiPgT'+i,`页${i+1} · ${z.title}`,zx,362,180,17,z.unlocked?(z.seen?LIGHT:GOLD):tone('#7a6c52'));
    U.text('SeasonZhiPgS'+i,z.unlocked?(z.seen?'已读 · 重读 >':'可读 >'):'未解锁',zx,340,180,15,z.unlocked?GOLD:tone('#7a6c52'));
    if(z.unlocked&&!z.seen)U.dot('SeasonZhiDot'+i,zx+80,368);
    U.tap('SeasonZhiTap'+i,zx,348,190,64,()=>{seasonZhiOpen=z;ctx.show('season');});
  });
  // 名场面入口行（第二批）：空带 y=252
  if(info.scenes&&info.scenes.enabled){
    U.panel('SeasonSceneEntry',0,252,682,44,tone('#2b2118'),8,GOLD);
    U.text('SeasonSceneGlyph','名',-282,252,40,30,GOLD);
    U.text('SeasonSceneText',`名场面重演 · ${info.actName} 3 关 · 本季已清 ${info.scenes.clearedCount}/${info.scenes.total} >`,0,252,620,17,LIGHT);
    U.tap('SeasonSceneTap',0,252,682,44,()=>ctx.go('seasonScenes'));
  }
  // 幕任务
  U.text('SeasonActTitle','幕任务 · 战功主要来源（本周 3 条）',0,196,640,18,LIGHT);
  info.acts.forEach((a:any,i:number)=>{
    const y=140-i*56;
    U.panel('SeasonAct'+i,0,y,640,58,tone('#171009'),7,tone('#5a452a'));
    U.text('SeasonActLabel'+i,a.label,-160,y+10,420,18,LIGHT);
    U.text('SeasonActProg'+i,`${a.prog}/${a.target}`,70,y-16,110,15,tone('#a6906c'));
    U.button('SeasonActGo'+i,a.claimed?'已领':a.claimable?`领 ${a.medal} 战功`:'未完成',235,y,150,46,()=>{
      if(!a.claimable)return;
      const r=store.claimSeasonAct(a.idx);
      ctx.tell(r,r.ok?`战功 +${r.medal}`:'');
      if(r.ok)ctx.show('season');
    },a.claimable?GOLD:tone('#423022'));
  });
  // 战功商店
  U.text('SeasonShopTitle','战功商店 · 战功直购，不与元宝印信互通',0,-20,640,18,LIGHT);
  info.shop.forEach((g:any,i:number)=>{
    const x=-230+(i%3)*230, y=-66-Math.floor(i/3)*62;
    const soldOut=g.weekly>0&&g.bought>=g.weekly, seasonSold=g.weekly===0&&((store.getState().season as any).titleBought);
    U.panel('SeasonShop'+i,x,y,210,54,soldOut||seasonSold?tone('#171009'):tone('#3a2c17'),7,soldOut||seasonSold?tone('#5a452a'):GOLD);
    U.text('SeasonShopName'+i,g.name,x,y+10,200,15,LIGHT);
    U.text('SeasonShopCost'+i,`${g.medal} 战功`+(soldOut?' · 本周已兑':seasonSold?' · 本季已购':''),x,y-14,200,13,soldOut||seasonSold?tone('#6f8a5f'):tone('#d9b06a'));
    U.tap('SeasonShopTap'+i,x,y,210,54,()=>{const r=store.buySeasonGood(g.id);ctx.tell(r,r.ok?'兑换 '+r.name:'');if(r.ok)ctx.show('season');});
  });
  // 军资簿
  U.text('SeasonTrackTitle','军资簿 · 按本季累计战功领奖',0,-184,640,18,LIGHT);
  U.text('SeasonTrackEarned',`本季累计 ${info.medalEarned}`,220,-184,220,18,GOLD);
  const contentH=20*66+16;
  U.scroll('SeasonTrack',0,-352,688,300,contentH,(V)=>{
    info.track.forEach((t:any,i:number)=>{
      const y=contentH/2-33-i*66;
      V.panel('SeasonTrackRow'+i,0,y,656,56,t.claimed?tone('#26301f'):t.claimable?tone('#3a2c17'):tone('#171009'),7,t.claimed?tone('#6f8a5f'):t.claimable?GOLD:tone('#5a452a'));
      V.text('SeasonTrackLv'+i,`军资 Lv.${t.level} · 累计${t.need}`,-230,y,340,19,t.claimed?tone('#a99778'):t.claimable?GOLD:LIGHT);
      const giveTxt=Object.entries(t.give).map(([k,n]:any)=>`${({gold:'铜钱',shard:'通用碎片',stones:'淬火石',title:'称号'} as any)[k]||k}×${n}`).join(' · ');
      V.text('SeasonTrackGive'+i,giveTxt,30,y,320,17,t.claimed?tone('#6f8a5f'):LIGHT);
      if(t.claimed)V.text('SeasonTrackGo'+i,'已 领',244,y,120,19,tone('#6f8a5f'));
      else if(t.claimable)V.button('SeasonTrackGo'+i,'领 取',244,y,120,44,()=>{
        const r=store.claimSeasonTrack(t.level);
        ctx.tell(r,r.ok?'军资已领取':'');
        if(r.ok)ctx.show('season');
      },GOLD);
      else V.text('SeasonTrackGo'+i,`还差 ${t.need-info.medalEarned}`,244,y,120,16,tone('#7a6c52'));
    });
  });
  firstTimeOverlay(ctx,'season');
  // 卷志弹层
  if(seasonZhiOpen){
    U.rect('SeasonZhiShade',0,0,720,1280,new Color(12,10,8,190));
    U.tap('SeasonZhiShadeTap',0,0,720,1280,()=>{seasonZhiOpen=null;ctx.show('season');});
    U.panel('SeasonZhiPanel',0,60,658,782,tone('#251b14'),12,GOLD);
    U.tap('SeasonZhiBlock',0,60,658,782,()=>{});
    U.text('SeasonZhiPgTitle',`卷志 · ${seasonZhiOpen.title}`,0,346,560,30,GOLD);
    U.text('SeasonZhiBody',seasonZhiOpen.text,0,180,540,20,tone('#f0e6cd'));
    U.button('SeasonZhiClose','合 上',0,-243,270,55,()=>{seasonZhiOpen=null;ctx.show('season');},tone('#3a2b20'));
  }
}
let seasonZhiOpen:any=null;

// 名场面重演（四时战纪第二批）：当幕 3 关 + 十二幕总览
export function seasonScenesView(ctx: ScreenContext) {
  const U=ctx.ui,si=store.scenesInfo();
  ctx.title('名 场 面 重 演');
  U.backBar(()=>ctx.go('season'));
  if(!si.enabled){U.text('SceneClosed','名场面暂未开放',0,200,600,20,LIGHT);return;}
  U.text('SceneHead',`本幕 · ${si.actName} · 已清 ${si.clearedCount}/${si.total}`,0,443,640,20,GOLD);
  si.current.forEach((sc:any,i:number)=>{
    const y=330-i*96;
    const typeName=sc.type==='faction'?'阵营关':sc.type==='speed'?'限时关':'禁疗关';
    U.panel('SceneCard'+i,0,y,640,84,sc.cleared?tone('#26301f'):tone('#3a2c17'),9,sc.cleared?tone('#6f8a5f'):GOLD);
    U.text('SceneCardName'+i,`${sc.name} · ${typeName}${sc.type==='faction'?('（'+({shu:'蜀',wei:'魏',wu:'吴',qun:'群'} as any)[sc.faction]+'）'):''}`,0,y+24,420,22,sc.cleared?tone('#a99778'):GOLD);
    const mechTxt=Object.entries(sc.passive).map(([k,v]:any)=>`${(si.mechNames as any)[k]||k}(${typeof v==='number'&&v<1?Math.round(v*100)+'%':v})`).join(' · ');
    U.text('SceneCardMech'+i,`敌主将 ${(heroes.getHero(sc.boss)||{}).name||sc.boss} · ${mechTxt}`,0,y-10,340,15,LIGHT);
    U.text('SceneCardMedal'+i,`战功 +${sc.medal}`,-230,y-10,150,15,tone('#d9b06a'));
    if(sc.cleared)U.text('SceneCardDone'+i,'已 达 成',244,y,150,20,tone('#6f8a5f'));
    else U.button('SceneCardGo'+i,'出 战',244,y,150,52,()=>{(ctx as any).sceneKey=sc.key;ctx.startBattle('scene',1);},palette.gold);
  });
  U.text('SceneLegend','阵营关=仅该阵营上阵 · 限时关=60 秒取胜 · 禁疗关=治疗吸血无效（护盾有效）',0,82,640,15,tone('#7a6c52'));
  U.text('SeasonOverviewTitle','十二幕总览',0,48,640,18,LIGHT);
  const contentH=12*62+16;
  U.scroll('SceneOverview',0,-208,688,300,contentH,(V)=>{
    const volNames=['黄巾乱世','官渡相持','赤壁纵火','鼎足归尘'];
    volNames.forEach((vname:string,vi:number)=>{
      const vy=contentH/2-31-vi*62;
      V.panel('SeasonOverviewRow'+vi,0,vy,656,52,vi+1===si.vol?tone('#3a2c17'):tone('#171009'),7,vi+1===si.vol?GOLD:tone('#5a452a'));
      const done=[1,2,3].every((ai:number)=>[1,2,3].every(s=>si.list.some((x:any)=>x.key===`v${vi+1}a${ai}s${s}`&&x.cleared)));
      V.text('SeasonOverviewName'+vi,`卷${vi+1} · ${vname}`,0,vy,640,18,vi+1===si.vol?GOLD:LIGHT);
      V.text('SeasonOverviewDone'+vi,done?'全通':`已清 ${si.list.filter((x:any)=>x.key.charAt(1)===String(vi+1)&&x.cleared).length}/9`,0,vy-16,640,14,done?GOLD:tone('#7a6c52'));
    });
  });
}

let bountyPickIdx = -1;
let expBoonDismissedFloor = -1; // 加护弹层「稍后再选」标记：同层不再弹，新一层 offer 再弹
let agendaOpen = false; // 今日军务展开弹层（研讨会十二 C1）

export function bountyView(ctx: ScreenContext) {
  const info=store.bountyInfo(),U=ctx.ui,s=store.getState();
  ctx.title('悬 赏 派 遣');
  U.backBar(()=>ctx.back('journey'));
  U.text('BountyGuide','每日 4 单 · 派同阵营武将该单铜钱元宝 +20% · 跨日自动补发',0,443,640,18,tone('#ad9977'));
  info.list.forEach((b:any,i:number)=>{
    const y=360-i*124;
    const reward=Object.entries(b.reward).map(([k,n]:any)=>`${store.CURRENCY_NAME[k]||k}×${fmt.fmtNum(n)}`).join(' · ');
    U.panel('BountyCard'+i,0,y,640,110,
      b.state==='done'?tone('#3a2c17'):b.state==='claimed'?tone('#26301f'):tone('#312218'),9,
      b.state==='done'?GOLD:tone('#795b34'));
    U.text('BountyName'+i,b.name,-220,y+24,220,24,GOLD);
    U.text('BountyHours'+i,`${b.hours} 小时`,210,y+24,120,19,tone('#ad9977'));
    U.text('BountyReward'+i,reward,-160,y-14,420,18,LIGHT);
    const heroName=b.heroId?(heroes.getHero(b.heroId)?.name||b.heroId):'';
    if(b.state==='open'){
      // 同阵营派遣加成（裁决 E）：徽标放奖励行下方左侧，远离右侧按钮（体验官二号 P1）
      if(b.wantFaction){
        const fname=(config.FACTIONS as any)[b.wantFaction]?.name||'';
        const pct=Math.round((b.bonusPct||0)*100);
        U.text('BountyWant'+i,`征${fname}将 · 该单 +${pct}%`,-160,y-40,260,16,GOLD);
      }
      U.button('BountyAct'+i,'派 遣',240,y-28,150,52,()=>{bountyPickIdx=i;ctx.show('bounty');},palette.gold);
    }else if(b.state==='running'){
      const h=Math.floor(b.remainMs/3600000),m=Math.floor(b.remainMs%3600000/60000);
      U.text('BountyAct'+i,`${heroName} · 归来还需 ${h}时${m}分`,110,y-38,340,18,tone('#ad9977'));
      if(b.wantFaction){
        const fname=(config.FACTIONS as any)[b.wantFaction]?.name||'';
        U.text('BountyWant'+i,b.bonusActive?`已生效 +${b.realizedPct||20}%`:`非${fname}将`, -160,y-40,250,16,b.bonusActive?tone('#6f8a5f'):tone('#7a6c52'));
      }
    }else if(b.state==='done'){
      U.button('BountyAct'+i,'领 赏',240,y-28,150,52,()=>ctx.tell(store.claimBounty(i),`已领赏：${b.name}`),palette.red);
      U.text('BountyHero'+i,`${heroName}${b.bonusActive&&b.realizedPct?` · 加成+${b.realizedPct}%`:''}`,-180,y-38,300,17,tone('#ad9977'));
    }else{
      U.text('BountyAct'+i,'已完成 · 已领赏',150,y-38,360,18,tone('#6f8a5f'));
    }
  });
  firstTimeOverlay(ctx,'bounty');
  if(bountyPickIdx>=0){
    const pickIdx=bountyPickIdx;
    U.rect('BountyPickShade',0,0,720,1280,new Color(12,10,8,190));
    U.tap('BountyPickShadeTap',0,0,720,1280,()=>{bountyPickIdx=-1;ctx.show('bounty');});
    U.panel('BountyPickPanel',0,0,658,974,tone('#251b14'),12,GOLD);
    U.tap('BountyPickBlock',0,0,658,974,()=>{});
    const ids=Object.keys(s.roster).filter(id=>s.roster[id]&&heroes.getHero(id))
      .sort((a:string,b:string)=>(heroes.getHero(b).rarity-heroes.getHero(a).rarity)||a.localeCompare(b));
    const slice=ids;
    U.text('BountyPickTitle',`选择出征武将 · 可派 ${ids.length} 人`,0,427,560,30,GOLD);
    const pickBounty=store.bountyInfo().list[pickIdx];
    const pfName=pickBounty&&pickBounty.wantFaction?((config.FACTIONS as any)[pickBounty.wantFaction]?.name||''):'';
    U.text('BountyPickHint',pickBounty?(pickBounty.wantFaction?`${pickBounty.name} · ${pickBounty.hours} 小时 · 派${pfName}将该单铜钱元宝+${Math.round((pickBounty.bonusPct||0)*100)}%`:`${pickBounty.name} · ${pickBounty.hours} 小时 · ${Object.entries(pickBounty.reward).map(([k,n]:any)=>`${store.CURRENCY_NAME[k]||k}×${fmt.fmtNum(n)}`).join(' · ')}`):'出征不影响出战阵容；同一武将同时只能接一单',0,388,600,17,tone('#ad9977'));
    U.scroll('BountyPickScroll',0,-30,600,760,Math.max(760,slice.length*92),V=>{
      slice.forEach((id,j)=>{
        const hero=heroes.getHero(id),y=Math.max(760,slice.length*92)/2-46-j*92;
        const busy=!!info.busyHeroIds[id];
        V.panel('BountyHero'+j,0,y,574,82,tone('#312218'),8,tone('#795b34'));
        V.text('BountyHeroName'+j,hero.name,-190,y+12,200,23,LIGHT);
        V.text('BountyHeroSub'+j,`${['','N','R','SR','SSR'][hero.rarity]} · ${hero.title||''}`,-190,y-22,260,16,tone('#ad9977'));
        if(busy){V.text('BountyHeroState'+j,'途中',225,y,110,18,tone('#a99778'));}
        else{
          V.button('BountyHeroGo'+j,'派遣',225,y,120,54,()=>{
            const r=store.dispatchBounty(pickIdx,id);
            bountyPickIdx=-1;
            ctx.tell(r,r.ok?`${heroes.getHero(id).name} 已派遣出征`:'');
          },palette.gold);
        }
      });
    });
    U.button('BountyPickCancel','取消',0,-452,300,56,()=>{bountyPickIdx=-1;ctx.show('bounty');},tone('#423022'));
  }
}

export function sevenDayView(ctx: ScreenContext) {
  const info=store.sevenDayInfo(),U=ctx.ui;
  ctx.title('七 日 目 标');
  const sd=info;
  U.backBar(()=>ctx.back('campaign'));
  U.text('SevenDayGuide',sd.expired?'七日目标已结束 · 未领奖励由第二周目标接续':'开服首 7 天每天一份厚礼；漏领可在 7 天内补领',0,443,640,18,tone('#ad9977'));
  info.list.forEach((d:any,i:number)=>{
    const y=375-i*116;
    U.panel('SevenDay'+i,0,y,640,102,
      d.claimed?tone('#26301f'):d.claimable?tone('#3a2c17'):tone('#2b2118'),9,
      d.claimable?GOLD:tone('#6b5837'));
    U.text('SevenDayDay'+i,`第${SEVEN_DAY_CN[i]}天`,-228,y+20,150,26,d.claimable?GOLD:d.claimed?tone('#6f8a5f'):tone('#a99778'));
    U.text('SevenDayLabel'+i,d.label,-66,y-14,360,22,d.locked?tone('#a99778'):LIGHT);
    U.text('SevenDayState'+i,d.claimed?'已领取':d.claimable?'待领取 >':sd.expired?'已过期':`第 ${d.day} 天解锁`,205,y+18,160,20,d.claimable?GOLD:d.claimed?tone('#6f8a5f'):sd.expired?tone('#6b5837'):tone('#a99778'));
    if(d.claimable)U.tap('SevenDayTap'+i,0,y,640,102,()=>{
      const r=store.claimSevenDay(d.day);
      ctx.tell(r,r.ok?`已领取：${d.label}`:'');
    });
  });
  // 第二周目标（研讨会三方案 2）：第 8~14 天一次性里程碑，达成后随时可领
  const fd=store.fourteenDayInfo();
  U.text('FourteenTitle','第二周目标 · 第 8~14 天（达成后随时可领）',0,-388,640,18,GOLD);
  fd.list.forEach((d:any,i:number)=>{
    const x=i%2===0?-165:165, y=-430-Math.floor(i/2)*56;
    U.panel('Fourteen'+i,x,y,312,48,d.claimed?tone('#26301f'):d.claimable?tone('#3a2c17'):tone('#2b2118'),8,d.claimable?GOLD:tone('#6b5837'));
    U.text('FourteenCond'+i,`第 ${d.day} 天 · ${d.cond}`,x,y+9,286,15,d.claimed?tone('#6f8a5f'):d.claimable?GOLD:d.locked?tone('#a99778'):LIGHT);
    U.text('FourteenState'+i,d.claimed?'已领取':d.claimable?`${d.label} >`:d.locked?`第 ${d.day} 天解锁`:d.met?'已达成 · 待天数解锁':d.label,x,y-13,286,13,d.claimable?GOLD:tone('#a99778'));
    if(d.claimable)U.tap('FourteenTap'+i,x,y,312,48,()=>{
      const r=store.claimFourteenDay(d.day);
      ctx.tell(r,r.ok?'已领取：'+r.label:'');
    });
  });
}
