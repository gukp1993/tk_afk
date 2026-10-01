import { Color } from 'cc';
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
import { campaignMap, campaignFlag, campaignCamp, cityMap, CITY_BUILDINGS } from '../ui/Scenery';

const INK = tone('#3d4337'), PAPER = tone('#eee3bf'), GOLD = tone('#edcf88'), LIGHT = tone('#f5e8c9');
let chapterMapOpen=false;
let chapterMapCh=-1; // 地图浏览章（-1=当前章）
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
  // 设置入口（研讨会七批次乙）：主公面板点击进设置
  U.text('LordSettings','设置 ›',-184,545,150,16,tone('#c7cdac'));
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
    U.text('CurrentStageText',`当前 · 第 ${stage} 关${stage>stages.CHAPTERS.length*stages.STAGES_PER_CH?' · 循环':''}`,x+18,y-24,165,17,LIGHT);
  }
  U.text('MilestoneHint','主线里程碑：40/100 自选券 · 90/110/150 自选箱 · 120/140/160 完成礼',0,404,560,15,INK);
  const sd=store.sevenDayInfo();
  const fdBanner=store.fourteenDayInfo();
  if(sd.allDone&&!fdBanner.allDone){
    U.panel('FourteenBanner',-60,372,500,44,fdBanner.canClaim?tone('#3a2c17'):tone('#2b2118'),7,fdBanner.canClaim?GOLD:tone('#6b5837'));
    U.text('FourteenBannerText',fdBanner.canClaim?'第二周目标 · 有奖励可领 ›':`第二周目标 · 第 ${fdBanner.ageDays} 天 ›`,-60,372,470,18,fdBanner.canClaim?GOLD:LIGHT);
    U.tap('FourteenBannerTap',-60,372,500,44,()=>ctx.go('sevenDay'));
  }
  if(!sd.allDone&&!sd.expired){
    const claimable=sd.canClaim;
    U.panel('SevenDayBanner',-60,372,500,44,claimable?tone('#3a2c17'):tone('#2b2118'),7,claimable?GOLD:tone('#6b5837'));
    U.text('SevenDayBannerText',claimable?'七日目标 · 今天有奖励可领 ›':`七日目标 · 第 ${sd.cur} 天 ›`,-60,372,470,18,claimable?GOLD:LIGHT);
    U.tap('SevenDayBannerTap',-60,372,500,44,()=>ctx.go('sevenDay'));
  }
  const starInfo=store.campaignStarChestInfo();
  if(starInfo.claimable){
    U.panel('StarChestBanner',-60,336,500,40,tone('#3a2c17'),7,GOLD);
    U.text('StarChestText','章节星宝箱可领 · 点击领取 ›',-60,336,470,18,GOLD);
    U.tap('StarChestTap',-60,336,500,40,()=>{
      const r=store.claimStarChests();
      ctx.tell(r,r.ok?`已领取：${(r.got||[]).join('；')}`:'');
    });
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
  U.tap('JourneyTap',-288,-480,103,86,()=>{chapterMapOpen=true;chapterMapCh=chapter.idx;ctx.show('campaign');});
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
  const storyEnd=stages.CHAPTERS.length*stages.STAGES_PER_CH;
  const goalText=firstDone<config.FIRST_STAGE_END
    ?`第一期主线 ${firstDone}/${config.FIRST_STAGE_END} · 通关越多，挂机收益越高`
    :s.campaign.cleared>=storyEnd?`主线全通 ${storyEnd}/${storyEnd} · 循环乱世继续开放`
    :`二期征途 ${s.campaign.cleared}/${storyEnd} · 通关越多，挂机收益越高`;
  U.text('GoalHint',goalText,-151,-536,400,16,LIGHT);
  U.text('IdleMore','双倍 / 快收',278,-536,147,16,GOLD);
  U.tap('GoalTap',-150,-536,405,24,()=>ctx.go('stagePreview'));
  U.tap('IdleMoreTap',278,-536,147,24,()=>ctx.idleClaimChoice());
  const returnPending=store.getState().returnPending;
  if(returnPending){
    U.panel('ReturnBanner',0,-78,640,54,tone('#3a2c17'),9,GOLD);
    U.text('ReturnBannerText',`主公回来了！离开 ${returnPending.days} 天，回归补给：${returnPending.label}（已入账）›`,0,-70,600,16,GOLD);
    U.tap('ReturnBannerTap',0,-78,640,54,()=>{store.dismissReturnPending();ctx.show('campaign');});
  }
  // 锻造台开启宣告（研讨会六 B1）：第 6 颗 5★ 达成后一次性播报，点击直达锻造台
  if(s.forgeOpenNotice){
    U.panel('ForgeOpenBanner',0,-122,640,44,tone('#3a2c17'),9,GOLD);
    U.text('ForgeOpenBannerText','锻造台已开启 · 词条洗练解锁 ›',0,-122,600,17,GOLD);
    U.tap('ForgeOpenBannerTap',0,-122,640,44,()=>{s.forgeOpenNotice=false;store.save();ctx.go('forge');});
  }
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
    // 章切换（研讨会九 S2：扫荡需回看已通关章节）
    const maxCh=Math.min(stages.CHAPTERS.length-1,Math.floor(s.campaign.cleared/stages.STAGES_PER_CH));
    const viewIdx=Math.min(Math.max(0,chapterMapCh<0?chapter.idx:chapterMapCh),maxCh);
    chapterMapCh=viewIdx;
    const viewCh=stages.chapterOf(viewIdx*stages.STAGES_PER_CH+1);
    U.text('ChapterMapTitle',viewCh.name,0,437,440,29,GOLD);
    U.text('ChapterMapCount',`第${viewIdx+1}章 · 已通关 ${Math.max(0,Math.min(stages.STAGES_PER_CH,s.campaign.cleared-viewIdx*stages.STAGES_PER_CH))}/${stages.STAGES_PER_CH}`,0,393,580,19,LIGHT);
    U.button('ChapterMapPrev','‹',-284,415,56,44,()=>{chapterMapCh=Math.max(0,viewIdx-1);ctx.show('campaign');},viewIdx>0?tone('#5a452a'):tone('#332a1e'));
    U.button('ChapterMapNext','›',284,415,56,44,()=>{chapterMapCh=Math.min(maxCh,viewIdx+1);ctx.show('campaign');},viewIdx<maxCh?tone('#5a452a'):tone('#332a1e'));
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
    const fName=(config.FACTIONS as any)[unit.hero.faction]?.name||'';
    U.text('StageEnemy'+i,`${fName}·${unit.hero.name} Lv.${unit.level}${unit.isBoss?'·首领':''}`,-163,249-i*38,310,19,LIGHT);
  });
  const fCount:any={};
  enemy.units.forEach((unit:any)=>{fCount[unit.hero.faction]=(fCount[unit.hero.faction]||0)+1;});
  const domFaction=Object.keys(fCount).sort((a:string,b:string)=>fCount[b]-fCount[a])[0];
  if(enemy.mods&&enemy.mods.length){
    const modNames=enemy.mods.map((m:any)=>(config.CAMPAIGN_MODS.meta as any)[m]).filter(Boolean);
    U.text('StageModsHint',`机制：${modNames.map((m:any)=>m.name+' — '+m.desc).join('；')}`,0,70,620,16,palette.red);
  } else if(enemy.bossMod){
    U.text('StageModsHint',`敌方主将机制：${enemy.bossMod.name} — ${enemy.bossMod.desc}`,0,70,620,16,palette.red);
  }
  if(fCount[domFaction]>=4){
    const counterKey=Object.keys(config.BEATS).find((k:any)=>(config.BEATS as any)[k]===domFaction);
    const counterName=counterKey?(config.FACTIONS as any)[counterKey]?.name:'';
    // 光环显示按 ENEMY_FACTION_AURA 折算后的实际生效值，与战斗内一致
    const baseAura=config.factionBonus(fCount[domFaction]).atk;
    const realAura=Math.round(baseAura*(config as any).ENEMY_FACTION_AURA*1000)/10;
    U.text('StageAuraHint',`敌军同阵营×${fCount[domFaction]}（光环生效 +${realAura}%）· ${counterName}阵营对其伤害+25%`,0,46,610,17,tone('#d9a94e'));
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
  U.text('StageStarRule','评星：★1 通关 · ★2 限时 ≤60秒（精锐/机制关 70 秒）· ★3 存活 ≥4',0,-130,620,15,dim);
  U.text('StageOurTeam',`出战：${team||'尚未编队'}`,0,-159,610,18,dim);
  // 战前排兵三选一（试玩 P1 修补：与自动出征按钮完全错开，不再叠压）
  U.text('StageTacticTitle','战前战术（可选）',0,-247,300,16,tone('#8a9a7a'));
  (config.BATTLE_TACTICS as any[]).forEach((t:any,i:number)=>{
    const x=-196+i*196;
    const armed=(ctx as any).armedTactic===t.id;
    U.panel('StageTactic'+i,x,-284,186,46,armed?tone('#45321b'):tone('#312218'),7,armed?GOLD:tone('#5a452a'));
    U.text('StageTacticName'+i,t.name,x,-271,178,16,armed?GOLD:LIGHT);
    U.text('StageTacticDesc'+i,t.desc,x,-296,178,14,tone('#ad9977'));
    U.tap('StageTacticTap'+i,x,-284,186,46,()=>{(ctx as any).armedTactic=(ctx as any).armedTactic===t.id?null:t.id;ctx.show('stagePreview');});
  });
  const armedT=(config.BATTLE_TACTICS as any[]).find((t:any)=>t.id===(ctx as any).armedTactic);
  const autoLbl=armedT?`自动出征 · 战术：${armedT.name}`:'自动出征 · 连战';
  U.button('StageAuto',autoLbl,152,-345,290,54,()=>ctx.startAuto('campaign'),tone('#3d6653'));
  // 单场出战（2026-09-30 补）：唯一的手动首战入口，未读剧情会先插剧情页；败北可看处方单
  U.button('StageOnce','出战一次',-152,-345,290,54,()=>ctx.startBattle('campaign',stage),palette.red);
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
    U.text('CitySettings','设置 ›',-133,558,120,17,tone('#766a51'));
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
    const bt=store.bountyInfo();
    U.panel('JourneyBounty',0,-75,682,130,bt.canClaim?tone('#3a2c17'):tone('#312218'),10,bt.canClaim?GOLD:tone('#a17b40'));
    U.text('JourneyBountyGlyph','赏',-272,-60,59,49,GOLD);
    U.text('JourneyBountyName','悬赏派遣',-150,-60,180,28,LIGHT);
    U.text('JourneyBountyDesc','派武将出征，到时领赏 · 每日 4 单',-10,-95,430,18,tone('#ad9977'));
    const unread=store.takeBountyGrantsNotice();
    U.text('JourneyBountyStat',unread?`离线赏金×${unread} 已入账 ›`:bt.canClaim?'有赏可领 ›':bt.idleCount>0?`待派遣 ${bt.idleCount} 单`:bt.list.some((b:any)=>b.state==='running')?'出征途中':'今日已完成',30,-58,330,19,GOLD);
    U.tap('JourneyBountyTap',0,-75,682,130,()=>ctx.go('bounty'));
    const hi=store.hallInfo();
    U.panel('JourneyHall',0,-188,682,84,hi.seats.every((x:any)=>x.killed)?tone('#26301f'):tone('#312218'),10,hi.seats.every((x:any)=>x.killed)?tone('#6f8a5f'):tone('#a17b40'));
    U.text('JourneyHallGlyph','堂',-272,-173,59,49,GOLD);
    U.text('JourneyHallName','名人堂',-198,-173,180,26,LIGHT);
    U.text('JourneyHallDesc','本周名阵容挑战 · 荣耀与称号',-58,-213,430,17,tone('#ad9977'));
    U.text('JourneyHallStat',hi.seats.every((x:any)=>x.killed)?`本周全胜 · 荣耀 ${hi.honor}`:`已胜 ${hi.seats.filter((x:any)=>x.killed).length}/3 · 荣耀 ${hi.honor}`,-58,-183,430,18,GOLD);
    U.tap('JourneyHallTap',0,-188,682,84,()=>ctx.go('hall'));
    // 本周必做聚合卡（2026-09-30 裁决 B）：一眼看全周任务/名人堂/演武赛季，点击进远征周页
    const wk=progression.buildWeeklyBriefing(s,hi.seats);
    U.panel('JourneyWeekly',0,-290,682,104,(wk.questsDone<wk.questsTotal)?tone('#312218'):tone('#26301f'),10,(wk.questsDone<wk.questsTotal)?tone('#a17b40'):tone('#6f8a5f'));
    U.text('JourneyWeeklyGlyph','周',-272,-270,59,49,GOLD);
    U.text('JourneyWeeklyName','本周必做',-158,-270,180,26,LIGHT);
    U.text('JourneyWeeklyStat',`任务 ${wk.questsDone}/${wk.questsTotal} · 演武 ${wk.arenaRank}`,120,-269,280,18,GOLD);
    U.text('JourneyWeeklyDesc','周任务与活跃宝箱在远征页领取',-58,-305,430,17,tone('#ad9977'));
    U.text('JourneyWeeklyReplay',`战报 · 最近 ${(store.replaysInfo().list as any[]).length} 场 ›`,-58,-330,300,17,GOLD);
    U.tap('JourneyWeeklyReplayTap',110,-330,240,34,()=>ctx.go('hall'));
    U.tap('JourneyWeeklyTap',0,-280,682,60,()=>ctx.go('expedition'));
    // 军屯双本入口（研讨会四 P2）
    // 今日军务折叠带（研讨会十二 C1）：单行入口，红点只挂可领取
    {
      const ag=store.dailyAgendaInfo();
      if(ag.enabled&&ag.total>0){
        const ns=ag.nextStep?(ag.entries as any[]).find(e=>e.key===ag.nextStep!.key):null;
        const txt=ag.count>=ag.total?`今日军务 ${ag.count}/${ag.total} · 已清 · 勤勉 ${ag.agendaDays} 天 ›`
          :`今日军务 ${ag.count}/${ag.total} · 下一步：${ns?ns.label:'稍后再来'} ›`;
        const allDone=ag.count>=ag.total;
        U.panel('AgendaBand',0,-368,682,36,allDone?tone('#26301f'):tone('#2b2118'),8,allDone?tone('#6f8a5f'):GOLD);
        U.text('AgendaBandTxt',txt,0,-368,640,17,allDone?tone('#a99778'):GOLD);
        if(ag.nextStep&&ag.nextStep.tier==='claim')U.dot('AgendaDot',296,-376);
        U.tap('AgendaBandTap',0,-368,682,36,()=>{agendaOpen=true;ctx.show('journey');});
      }
    }
    const dg=store.dungeonInfo();
    if(dg.enabled){
      U.panel('JourneyDungeon',0,-430,682,70,tone('#312218'),10,tone('#a17b40'));
      U.text('JourneyDungeonGlyph','屯',-272,-415,59,49,GOLD);
      U.text('JourneyDungeonName','军屯双本',-158,-415,180,26,LIGHT);
      U.text('JourneyDungeonStat',dg.runsLeft>0?`剩 ${dg.runsLeft} 次 · 屯金 ${dg.gold.best}/10 · 屯兵 ${dg.train.best}/10`:dg.runsLeft<=0&&dg.runs>=dg.daily?'今日次数已用完':'',120,-414,280,18,GOLD);
      U.text('JourneyDungeonDesc','屯金得铜钱 · 屯兵得主公经验 · 每日各 2 次',-58,-450,470,17,tone('#ad9977'));
      U.tap('JourneyDungeonTap',0,-430,682,70,()=>ctx.go('dungeon'));
    }
    // 周常 Boss 横幅（研讨会四 P3）：导航红线上方窄带
    const wb=store.weekBossInfo();
    if(wb.enabled){
      U.panel('JourneyWeekBoss',0,-500,682,44,wb.attemptsLeft>0?tone('#3a2c17'):tone('#2b2118'),8,wb.attemptsLeft>0?GOLD:tone('#6b5837'));
      U.text('JourneyWeekBossText',`本周魔王 · ${wb.bossName} · 最高伤害 ${(wb.bestPct*100).toFixed(1)}% · 剩 ${wb.attemptsLeft} 次 ›`,0,-500,650,17,wb.attemptsLeft>0?GOLD:LIGHT);
      U.tap('JourneyWeekBossTap',0,-500,682,44,()=>ctx.go('weekboss'));
    }
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
          V.text('AgendaGo'+i,'前往 ›',250,y,120,18,e.done?tone('#6f8a5f'):GOLD);
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
  U.text('WbBack','‹ 返回',-291,484,130,22,GOLD);
  U.tap('WbBackTap',-291,484,136,52,()=>ctx.back('journey'));
  if(!wb.enabled){
    U.text('WbClosed','魔王讨伐暂未开放',0,200,600,20,LIGHT);
    return;
  }
  U.panel('WbBossCard',0,330,682,150,tone('#2a1210'),12,palette.red);
  U.seal('WbBossGlyph',-272,340,64,'魔',palette.red,palette.red,tone('#f0e6cd'),34);
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
  U.text('SetBack','‹ 返回',-291,484,130,22,GOLD);
  U.tap('SetBackTap',-291,484,136,52,()=>ctx.back('home'));
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
  U.text('DungeonBack','‹ 返回',-291,484,130,22,GOLD);
  U.tap('DungeonBackTap',-291,484,136,52,()=>ctx.back('journey'));
  U.text('DungeonGuide',`每日 ${info.daily} 次 · 双轨共用次数 · 层数顺序解锁 · 敌力随主公等级缩放`,0,443,640,18,tone('#ad9977'));
  U.text('DungeonRuns',`今日剩余次数：${info.runsLeft} / ${info.daily}`,0,404,640,20,info.runsLeft>0?GOLD:tone('#a99778'));
  const tracks=[
    { key:'gold', name:'屯金本', glyph:'金', desc:'胜利奖励铜钱', best:info.gold.best, next:info.gold.next, elv:info.gold.enemyLevel, rp:info.gold.rewardPreview?`铜钱 ${fmt.fmtNum(info.gold.rewardPreview)}`:'', color:tone('#d9a94e') },
    { key:'train', name:'屯兵本', glyph:'兵', desc:'胜利奖励主公经验', best:info.train.best, next:info.train.next, elv:info.train.enemyLevel, rp:info.train.next?`经验 ${60+15*info.train.enemyLevel}`:'', color:tone('#7fbd94') }
  ];
  tracks.forEach((t:any,i:number)=>{
    const x=i%2===0?-171:171, y=170;
    U.panel('DungeonTrack'+i,x,y,330,300,tone('#312218'),10,t.color);
    U.seal('DungeonGlyph'+i,x,y+108,56,t.glyph,t.color,t.color,tone('#3a2b20'),30);
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
    U.panel('BagResourcesTab',-169,385,308,63,palette.gold,9);
    U.text('BagResourcesText','资源道具',-169,385,283,24,INK);
    U.panel('BagArmoryTab',169,385,308,63,tone('#342518'),9,GOLD);
    U.text('BagArmoryText','军械图鉴',169,385,280,23,GOLD);
    U.tap('BagArmoryTap',169,385,308,63,()=>ctx.go('armory'));
    const resources:any[]=[
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
    U.text('BagGuide','点击物资卡片，前往对应功能使用',0,-332,620,18,tone('#ad9977'));
    [['典','图鉴收集 · 集齐阵营领厚礼','codex'],['勋','主公成就 · 十一轴长线目标','achv'],['远','远征周 · 周任务与词缀挑战','expedition']].forEach(([glyph,label,page]:any,i:number)=>{
      const ey=-372-i*64;
      U.panel('BagEntry'+i,0,ey,682,52,tone('#312218'),8,tone('#795b34'));
      U.text('BagEntryGlyph'+i,String(glyph),-290,ey,44,30,GOLD);
      U.text('BagEntryLabel'+i,String(label),-128,ey,400,19,LIGHT);
      U.text('BagEntryGo'+i,'›',290,ey,40,19,GOLD);
      U.tap('BagEntryTap'+i,0,ey,682,52,()=>ctx.go(page as Page));
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
      let row=0;
      if(roamerRows){
        V.text('RoamerTitle','神秘商人 · 今日限量（跨日换新）',0,contentH/2-roamerBlockH+30,600,22,GOLD);
        roamer.goods.forEach((good:any,ri:number)=>{
          const y=contentH/2-51-row*101;row++;
          V.panel('RoamerGood'+ri,0,y,662,92,tone('#3a2c17'),8,GOLD);
          V.text('RoamerName'+ri,good.name,-150,y+19,334,26,LIGHT);
          V.text('RoamerLimit'+ri,good.bought?'今日已购 · 明日换新':'限量 1 件 · 今日有效',-187,y-21,300,18,good.bought?tone('#6f8a5f'):tone('#d9a94e'));
          V.button('RoamerBuy'+ri,good.bought?'已购':`${fmt.fmtNum(good.price)} ${store.CURRENCY_NAME[good.cur]}`,233,y,198,62,()=>{
            if(good.bought)return;
            ctx.confirm('确认购买',`向神秘商人购买 ${good.name}；消耗 ${fmt.fmtNum(good.price)} ${store.CURRENCY_NAME[good.cur]}。`,()=>{
              ctx.tell(store.buyRoamer(good.id),`购得 ${good.name}`);
            });
          },good.bought||s.res[good.cur]<good.price?tone('#423022'):palette.red);
        });
      }
      goods.forEach((good:any,i:number)=>{
        const y=contentH/2-51-(row+i)*101,bought=s.buyLog.buys[good.id]||0,sold=bought>=good.limit,afford=s.res[good.cur]>=good.price;
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
      V.text('ShopTip','满星后的同名卡可兑换碎片；关闭自选窗口不会消耗自选券。',0,contentH/2-51-(row+goods.length)*101-16,645,16,tone('#ad9977'));
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
    U.heroIcon('SlotAvatar'+i,x,y+22,145,100,hero?{surname:hero.surname||hero.name[0],faction:hero.faction,rarity:hero.rarity}:{surname:'+'});
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
  // 借将助战（研讨会五批次 1）：本周助将位每日一次借用，作第 6 人上阵（仅 PVE）
  const bb=store.borrowInfo();
  if(bb.enabled){
    U.panel('BorrowBanner',0,-510,682,48,tone('#26301f'),8,bb.active?tone('#6f8a5f'):GOLD);
    if(bb.active){
      const bn=heroes.getHero(bb.active)?.name||bb.active;
      U.text('BorrowTxt',`${bn}·借 已随军上阵（仅 PVE）· 明日可换`,0,-510,560,18,GOLD);
      U.tap('BorrowDismissTap',0,-510,682,48,()=>{const r=store.dismissBorrow();ctx.tell(r,r.ok?'助战将已撤下':'');});
    }else{
      U.text('BorrowTxt',`今日助战：${bb.heroName} Lv.${bb.level}·${bb.star}★·不吃养成`,-150,-510,420,17,LIGHT);
      U.button('BorrowGo','借 用',230,-510,150,38,()=>{const r=store.borrowHero(bb.heroId);ctx.tell(r,r.ok?`${bb.heroName} 已随军（第 6 人，仅 PVE）`:'');},palette.gold);
    }
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
    U.text('BondState'+i,active?'已激活':missing.length?`缺 ${missing.map((hid:string)=>heroes.getHero(hid)?.name||hid).join('')}`:'未上阵',225,y,150,17,active?GOLD:tone('#a99778'));
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
    // 赛季条（2026-09-30 裁决 A）：本周段位 + 周段位奖进度 + 软重置预览，点击进演武榜
    const season=store.arenaSeasonInfo();
    U.panel('ArenaSeason',0,237,682,62,tone('#26301f'),9,tone('#6f8a5f'));
    U.text('ArenaSeasonMain',`本周 ${season.rank} · ${season.points} 分`,-168,250,330,22,GOLD);
    U.text('ArenaSeasonSub',`周段位奖 ${season.claimedCount}/${season.tiers.length} · 下周一重置至约 ${season.carryPreview} 分`,-131,225,400,16,tone('#ad9977'));
    U.text('ArenaSeasonGo','榜单 ›',255,250,120,22,GOLD);
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
      U.text('ArenaEnemy'+i,o.name,-161,y+32,320,26,GOLD);
      U.text('ArenaDifficulty'+i,o.diff>1.2?'凶险':'寻常',267,y+32,115,18,o.diff>1.2?palette.red:tone('#ad9977'));
      U.text('ArenaEnemyPower'+i,`守军约 Lv.${enemy.units[0].level} · 战力 ${fmt.fmtNum(power)}`,-138,y-26,369,18,tone('#ad9977'));
      const fCountA:any={};
      enemy.units.forEach((unit:any)=>{fCountA[unit.hero.faction]=(fCountA[unit.hero.faction]||0)+1;});
      const domA=Object.keys(fCountA).sort((a:string,b:string)=>fCountA[b]-fCountA[a])[0];
      const domNameA=(config.FACTIONS as any)[domA]?.name||'';
      const counterA=Object.keys(config.BEATS).find((k:any)=>(config.BEATS as any)[k]===domA);
      U.text('ArenaFaction'+i,`${domNameA}×${fCountA[domA]} · ${counterA?(config.FACTIONS as any)[counterA]?.name:''}克`,105,y+32,180,16,tone('#ad9977'));
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
    if(ctx.storyReview){
      // 剧情回顾模式（用户指令 2026-10-01：剧情交互友好化）：只读回看，不进战斗
      U.text('StoryReviewTag','剧 情 回 顾 · 只读',0,-360,400,17,tone('#a99778'));
      U.panel('StoryFight',0,-420,460,78,tone('#3a2b20'),9,GOLD);
      U.text('StoryFightText','返回剧情回顾',0,-420,438,27,LIGHT);
      U.tap('StoryFightTap',0,-420,460,78,()=>{ctx.storyReview=false;ctx.go('storyArchive');});
    } else {
      U.panel('StoryFight',0,-392,460,78,palette.red,9,GOLD);
      U.text('StoryFightText','开始战斗',0,-392,438,27,LIGHT);
      U.tap('StoryFightTap',0,-392,460,78,()=>{
        store.markStorySeen(ctx.storyStage); store.save(); ctx.startBattle('campaign',ctx.storyStage);
      });
      U.text('StoryBackText','返回关卡预览',0,-482,318,20,GOLD);
      U.tap('StoryBackTap',0,-482,318,45,()=>ctx.back('stagePreview'));
    }
  }

export function storyArchiveView(ctx: ScreenContext) {
  const U=ctx.ui,s=store.getState();
  const cleared=s.campaign.cleared||0;
  const maxCh=Math.min(15,Math.floor(cleared/10));
  const chIdx=Math.min(Math.max(0,ctx.storyArchiveCh||0),maxCh);
  ctx.storyArchiveCh=chIdx;
  ctx.title('剧 情 回 顾');
  U.text('ArcBack','‹ 返回',-291,484,130,22,GOLD);
  U.tap('ArcBackTap',-291,484,136,52,()=>ctx.go('campaign'));
  U.panel('ArcChPanel',0,392,640,126,tone('#312218'),9,GOLD);
  U.button('ArcPrev','‹',-268,412,84,52,()=>{ctx.storyArchiveCh=Math.max(0,chIdx-1);ctx.show('storyArchive');},chIdx>0?tone('#5a452a'):tone('#332a1e'));
  U.button('ArcNext','›',268,412,84,52,()=>{ctx.storyArchiveCh=Math.min(maxCh,chIdx+1);ctx.show('storyArchive');},chIdx<maxCh?tone('#5a452a'):tone('#332a1e'));
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
      V.text('ArcRowState'+i,seen?'已读 · 回顾 ›':open?'未读,可阅':'未开放',225,y,150,17,seen?GOLD:open?tone('#a99778'):tone('#6b5837'));
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
  U.text('HallBack','‹ 返回',-291,484,130,22,GOLD);
  U.tap('HallBackTap',-291,484,136,52,()=>ctx.go('journey'));
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
  U.text('ExpBack','‹ 返回',-291,484,130,22,GOLD);
  U.tap('ExpBackTap',-291,484,136,52,()=>ctx.go('journey'));
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
  U.text('ExpActiveTitle','周活跃宝箱 · 按本周累计印信领额外印信',0,140,640,18,LIGHT);
  (w.active as any[]).forEach((a:any,i:number)=>{
    const x=-236+i*236;
    U.panel('ExpActive'+i,x,88,210,84,a.claimed?tone('#26301f'):a.claimable?tone('#3a2c17'):tone('#171009'),7,a.claimed?tone('#6f8a5f'):a.claimable?GOLD:tone('#5a452a'));
    U.text('ExpActiveNeed'+i,`累计印信 ${a.need}`,x,114,200,17,a.claimable?GOLD:LIGHT);
    U.text('ExpActiveReward'+i,`奖 印信 ×${a.reward.seals||0}`,x,90,200,15,tone('#d9b06a'));
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

let bountyPickIdx = -1;
let expBoonDismissedFloor = -1; // 加护弹层「稍后再选」标记：同层不再弹，新一层 offer 再弹
let agendaOpen = false; // 今日军务展开弹层（研讨会十二 C1）

export function bountyView(ctx: ScreenContext) {
  const info=store.bountyInfo(),U=ctx.ui,s=store.getState();
  ctx.title('悬 赏 派 遣');
  U.text('BountyBack','‹ 返回',-291,484,130,22,GOLD);
  U.tap('BountyBackTap',-291,484,136,52,()=>ctx.back('journey'));
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
  U.text('SevenDayBack','‹ 返回',-291,484,130,22,GOLD);
  U.tap('SevenDayBackTap',-291,484,136,52,()=>ctx.back('campaign'));
  U.text('SevenDayGuide',sd.expired?'七日目标已结束 · 未领奖励由第二周目标接续':'开服首 7 天每天一份厚礼；漏领可在 7 天内补领',0,443,640,18,tone('#ad9977'));
  info.list.forEach((d:any,i:number)=>{
    const y=375-i*116;
    U.panel('SevenDay'+i,0,y,640,102,
      d.claimed?tone('#26301f'):d.claimable?tone('#3a2c17'):tone('#2b2118'),9,
      d.claimable?GOLD:tone('#6b5837'));
    U.text('SevenDayDay'+i,`第${SEVEN_DAY_CN[i]}天`,-228,y+20,150,26,d.claimable?GOLD:d.claimed?tone('#6f8a5f'):tone('#a99778'));
    U.text('SevenDayLabel'+i,d.label,-66,y-14,360,22,d.locked?tone('#a99778'):LIGHT);
    U.text('SevenDayState'+i,d.claimed?'已领取':d.claimable?'待领取 ›':sd.expired?'已过期':`第 ${d.day} 天解锁`,205,y+18,160,20,d.claimable?GOLD:d.claimed?tone('#6f8a5f'):sd.expired?tone('#6b5837'):tone('#a99778'));
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
    U.text('FourteenState'+i,d.claimed?'已领取':d.claimable?`${d.label} ›`:d.locked?`第 ${d.day} 天解锁`:d.met?'已达成 · 待天数解锁':d.label,x,y-13,286,13,d.claimable?GOLD:tone('#a99778'));
    if(d.claimable)U.tap('FourteenTap'+i,x,y,312,48,()=>{
      const r=store.claimFourteenDay(d.day);
      ctx.tell(r,r.ok?'已领取：'+r.label:'');
    });
  });
}
