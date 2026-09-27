import { CocosUi, palette, hexColor as tone } from '../ui/CocosUi';
import { Node } from 'cc';
import { ScreenContext } from './ScreenContext';
import * as store from '../domain/store';
import * as heroData from '../domain/heroes';
import * as items from '../domain/items';
import * as config from '../domain/config';
import * as fmt from '../domain/fmt';
import * as progression from '../domain/progression';

const ink=tone('#171009'), panel=tone('#2e2113'), border=tone('#5a452a');
const gold=tone('#f0cf8a'), paper=tone('#e9d8b4'), dim=tone('#a6906c');
const rarityNames=['','N','R','SR','SSR'];
const rarityColors=['','#c8ccd4','#6f9fd8','#c99af0','#f0b95e'];
const factions:[string,string][]=[['all','全部'],['wei','魏'],['shu','蜀'],['wu','吴'],['qun','群']];
const sorts:[string,string][]=[['power','战力'],['level','等级'],['rarity','品质'],['star','品阶']];
let heroFaction='all',heroSort='power',showStarterPick=false;
let armoryItemId='';

function chip(U: ScreenContext['ui'], name:string, label:string, x:number,y:number,w:number,active:boolean,action:()=>void) {
    U.panel(name,x,y,w,48,active?tone('#d9a94e'):tone('#332518'),8,active?gold:border);
    U.text(name+'Text',label,x,y,w-8,20,active?ink:paper);
    U.tap(name+'Tap',x,y,w,48,action);
}

function armoryStats(stats: Record<string,number>|undefined) {
    const names:{[key:string]:string}={atk:'攻击',hp:'生命',def:'防御',spd:'攻速'};
    return Object.entries(stats||{}).filter(([key,value])=>names[key]&&Number(value)).map(([key,value])=>`${names[key]} +${Math.round(Number(value)*100)}%`).join(' · ')||'暂无属性加成';
}
function armoryEffect(effect: string|null|undefined) {
    return ({heal:'主动治疗与持续治疗效果提升',shield:'战斗开始时为全体英雄提供护盾',energy:'战斗开始时增加全体英雄怒气',reduction:'降低全体英雄受到的直接伤害'} as {[key:string]:string})[effect||'']||'';
}

export function heroes(ctx: ScreenContext) {
    const U=ctx.ui,s=store.getState();
    let list:any[]=store.allRoster();
    if(heroFaction!=='all')list=list.filter(h=>h.faction===heroFaction);
    const order=(h:any)=>heroSort==='rarity'?h.rarity*100000+h.power:heroSort==='star'?h.star*100000+h.power:Number(h[heroSort])||0;
    list.sort((a,b)=>order(b)-order(a));
    U.rect('HeroBackdrop',0,0,720,1280,ink);
    U.text('HeroesResources',`铜钱 ${fmt.fmtNum(s.res.gold)}     元宝 ${fmt.fmtNum(s.res.gem)}     招募令 ${s.res.scroll}`,0,606,685,20,gold);
    U.text('HeroesTitle','英雄 · 群英录',-157,548,390,40,gold);
    U.text('HeroesIntro','点击英雄，查看技能、升级与装备',-145,504,415,20,dim);
    U.panel('HeroesFormation',260,533,170,60,tone('#d9a94e'),8,gold);
    U.text('HeroesFormationText','调整编队',260,533,154,24,ink);
    U.tap('HeroesFormationTap',260,533,170,60,()=>ctx.go('formation'));
    const first=store.firstWinChoice().available;
    if(first){
      U.panel('StarterReward',0,456,686,53,tone('#d9a94e'),7,gold);
      U.text('StarterRewardText','首胜奖励：选择一名初始武将，自动升 1 星',0,456,670,21,ink);
      U.tap('StarterRewardTap',0,456,686,53,()=>{showStarterPick=true;ctx.show('heroes');});
    }
    const ownedY=first?384:438, filterY=first?300:354, sortY=first?238:292;
    U.panel('HeroOwnedPanel',0,ownedY,686,77,panel,8,border);
    U.text('HeroOwned',`已拥有 ${list.length} 名武将`,-156,ownedY+17,360,25,gold);
    U.text('HeroSharedLevel',`共享玩家等级 Lv.${store.playerLevel()} · 新将可立即上阵`,-85,ownedY-17,505,18,dim);
    U.text('HeroFactionLabel','阵营',-319,filterY,60,18,dim);
    factions.forEach(([key,label],i)=>chip(U,'Faction'+key,label,-235+i*117,filterY,105,key===heroFaction,()=>{heroFaction=key;CocosUi.resetScroll('HeroGrid');ctx.show('heroes');}));
    U.text('HeroSortLabel','排序',-319,sortY,60,18,dim);
    sorts.forEach(([key,label],i)=>chip(U,'Sort'+key,label,-220+i*155,sortY,142,key===heroSort,()=>{heroSort=key;CocosUi.resetScroll('HeroGrid');ctx.show('heroes');}));
    const scrollTop=sortY-44, scrollBottom=-532,viewH=scrollTop-scrollBottom;
    const rows=Math.ceil(list.length/3), pitch=318,contentH=Math.max(viewH,rows*pitch+14);
    U.scroll('HeroGrid',0,(scrollTop+scrollBottom)/2,696,viewH,contentH,grid=>{
      list.forEach((h:any,i:number)=>{
        const x=-228+(i%3)*228,y=contentH/2-157-Math.floor(i/3)*pitch;
        const data=heroData.getHero(h.id),rarity=data?.rarity||h.rarity||1;
        const accent=tone(rarityColors[rarity]);
        grid.panel('HeroCard'+i,x,y,213,300,panel,10,accent);
        grid.panel('HeroAvatar'+i,x,y+50,145,142,tone(h.faction==='wei'?'#28374a':h.faction==='shu'?'#263d32':h.faction==='wu'?'#493024':'#383047'),8,accent);
        grid.text('HeroAvatarText'+i,data?.surname||h.name[0],x,y+50,118,74,paper);
        grid.text('HeroCardName'+i,h.name,x-36,y-41,130,25,paper);
        grid.text('HeroCardRarity'+i,rarityNames[rarity],x+75,y-41,55,19,accent);
        grid.text('HeroCardTitle'+i,h.title||'',x,y-79,190,17,dim);
        const maxStar=(config.RARITIES?.[rarity]?.maxStar)||5;
        grid.text('HeroCardStars'+i,'★'.repeat(h.star||0)+'☆'.repeat(Math.max(0,maxStar-(h.star||0))),x,y-109,190,18,gold);
        grid.text('HeroCardLevel'+i,`Lv.${h.level||store.playerLevel()}`,x-53,y-136,100,17,gold);
        grid.text('HeroCardPower'+i,`战力 ${fmt.fmtNum(h.power)}`,x+49,y-136,105,17,dim);
        grid.tap('HeroCardTap'+i,x,y,213,300,()=>{ctx.selectedHeroId=h.id;ctx.go('heroDetail');});
      });
      if(!list.length){
        grid.text('EmptyHeroes',heroFaction==='all'?'还没有英雄，先去召唤一位吧':'还未拥有这个阵营的英雄',0,contentH/2-80,620,23,dim);
        grid.button('EmptySummon','前往召唤',0,contentH/2-165,240,60,()=>ctx.go('summon'),palette.gold);
      }
    });
    if(showStarterPick&&first){
      U.rect('StarterMask',0,0,720,1280,tone('#171009')).on(Node.EventType.TOUCH_END,()=>{showStarterPick=false;ctx.show('heroes');});
      U.panel('StarterPanel',0,0,660,444,panel,14,gold);
      U.text('StarterHeading','首胜奖励 · 选择一名武将升星',0,164,620,27,gold);
      ['liubei','guanyu','zhangfei'].forEach((id,i)=>{
        const h:any=heroData.getHero(id),x=-213+i*213;
        U.panel('StarterCard'+i,x,6,190,245,tone('#332518'),9,gold);
        U.panel('StarterFace'+i,x,43,125,121,tone('#314236'),8,gold);
        U.text('StarterGlyph'+i,h.surname||h.name[0],x,43,92,69,paper);
        U.text('StarterName'+i,h.name,x,-43,160,24,paper);
        U.button('StarterChoose'+i,'选择',x,-83,150,50,()=>{showStarterPick=false;ctx.tell(store.claimFirstWinChoice(id),`${h.name} 自动升星`);},palette.gold);
      });
    }
  }

export function heroDetail(ctx: ScreenContext) {
    const h:any=store.calcHero(ctx.selectedHeroId), owned:any=store.getOwned(ctx.selectedHeroId), U=ctx.ui;
    if(!h||!owned){ctx.go('heroes');return;}
    const s=store.getState(),maxStar=config.RARITIES[h.rarity].maxStar;
    const bonuses:any=store.getArmoryBonuses(),xpNeed=store.playerXpNeeded(s.player.level);
    const pct=(n:number)=>Math.round((Number(n)||0)*100)+'%';
    const factionName:{[key:string]:string}={wei:'魏',shu:'蜀',wu:'吴',qun:'群'};
    const clsName:{[key:string]:string}={warrior:'战士',tank:'坦克',mage:'法师',support:'辅助',assassin:'刺客'};
    U.rect('DetailBackdrop',0,0,720,1280,ink);
    U.text('DetailHeading','武 将',0,585,370,36,gold);
    U.text('DetailBack','‹ 返回',-288,585,130,23,gold);
    U.tap('DetailBackTap',-288,585,140,63,()=>ctx.back('heroes'));
    const contentH=1660,viewH=1130;
    U.scroll('DetailScroll',0,-75,708,viewH,contentH,V=>{
      const top=contentH/2;
      V.panel('DetailHeroPanel',0,top-113,680,184,panel,12,gold);
      V.panel('DetailPortrait',-242,top-113,142,146,tone('#314236'),9,tone(rarityColors[h.rarity]));
      V.text('HeroSurname',h.surname||h.name[0],-242,top-113,118,87,paper);
      V.text('DetailName',`${h.name}   ${rarityNames[h.rarity]}`,35,top-52,360,35,gold);
      V.text('DetailIdentity',`${h.title} · ${factionName[h.faction]||h.faction} · ${clsName[h.cls]||h.cls||'武将'}`,59,top-91,405,21,dim);
      V.text('DetailStars','★'.repeat(owned.star||0)+'☆'.repeat(Math.max(0,maxStar-(owned.star||0))),18,top-126,330,22,gold);
      V.text('DetailLevel',`全体共享 Lv.${h.level}  ·  战力 ${fmt.fmtNum(h.power)}`,62,top-162,420,20,paper);
      V.text('StatsHeading','属 性',-276,top-241,132,27,gold);
      V.panel('StatsPanel',0,top-328,680,139,panel,9,border);
      const stats:[string,string][]=[['生命',fmt.fmtNum(h.stats.hp)],['攻击',fmt.fmtNum(h.stats.atk)],['防御',fmt.fmtNum(h.stats.def)],['攻速',String(h.stats.spd)],['暴击',pct(h.stats.crit||0.05)],['同名卡',`${owned.cards}张`]];
      stats.forEach(([key,value],i)=>{
        const x=-224+(i%3)*224,y=top-297-Math.floor(i/3)*52;
        V.text('StatsKey'+i,key,x-46,y,86,20,dim);
        V.text('StatsValue'+i,value,x+42,y,117,20,paper);
      });
      V.text('SkillsHeading','技 能',-276,top-433,132,27,gold);
      V.panel('UltPanel',0,top-505,680,109,panel,9,border);
      V.text('Ult',`必杀  ${h.ult.name}`,-154,top-477,356,23,gold);
      V.text('UltDesc',h.ult.desc,0,top-522,626,20,paper);
      V.panel('PassivePanel',0,top-625,680,109,panel,9,border);
      V.text('Passive',`被动  ${h.passiveDef.name}`,-154,top-596,356,23,gold);
      V.text('PassiveDesc',h.passiveDef.desc,0,top-643,626,20,paper);
      V.text('ArmoryHeading','全军共享军械',-231,top-712,225,27,gold);
      V.panel('ArmoryBonusPanel',0,top-782,680,104,panel,9,border);
      V.text('ArmoryBonus',`攻击 +${pct(bonuses.atk)}   生命 +${pct(bonuses.hp)}   防御 +${pct(bonuses.def)}`,-59,top-751,529,19,gold);
      V.text('ArmoryShared','已享受当前军械，无需为武将单独配装',-84,top-797,485,18,dim);
      V.button('HeroArmory','军械图鉴 ›',238,top-798,163,51,()=>ctx.go('armory'),palette.paperDark);
      V.text('GrowthHeading','成 长',-276,top-878,132,27,gold);
      V.panel('GrowthPanel',0,top-1000,680,197,panel,9,border);
      V.text('GrowthLevel',`玩家等级 Lv.${s.player.level} · 全体武将共用`,-84,top-925,470,21,gold);
      V.progress('PlayerExperience',0,top-963,619,xpNeed?Math.min(1,s.player.exp/xpNeed):1,palette.gold);
      V.text('GrowthXP',s.player.level>=config.MAX_LEVEL?'等级已达上限':`战斗经验 ${fmt.fmtNum(s.player.exp)} / ${fmt.fmtNum(xpNeed)}`,-49,top-990,550,18,dim);
      V.text('GrowthStar',`星级 ★${owned.star} / ★${maxStar}${owned.star>=maxStar?' · 已满星':''}`,-158,top-1031,330,19,gold);
      V.text('GrowthStarHint',owned.star>=maxStar?'满星后重复卡可兑换英雄碎片':`抽到重复的 ${h.name} 会自动升星，无需铜钱`,-25,top-1064,590,18,dim);
      if(owned.cards>0){
        V.panel('ExtraCards',0,top-1144,680,90,panel,9,border);
        V.text('ExtraCardsText',`${owned.star>=maxStar?'满星后额外卡':'保留同名卡'} ${owned.cards} 张${owned.lockedCards?' · 已保护':''}`,-144,top-1122,385,20,gold);
        V.button('LockCards',owned.lockedCards?'取消保护':'保护',57,top-1164,153,48,()=>{
          const r:any=store.setCardsLocked(h.id,!owned.lockedCards);store.save();ctx.tell(r,r.locked?'同名卡已保护':'已取消保护');
        },palette.paperDark);
        const canConvert=owned.star>=maxStar&&!owned.lockedCards;
        V.button('ConvertCards','换 1 张碎片',245,top-1164,163,48,()=>{
          if(!canConvert)return ctx.tell({ok:false,msg:'仅可兑换未保护的满星多余卡'},'');
          const run=()=>{const r:any=store.convertCards([{id:h.id,count:1,confirmHigh:h.rarity>=3}]);store.save();ctx.tell(r,`获得英雄碎片 ×${r.shards||0}`);};
          if(h.rarity>=3)ctx.confirm('兑换高稀有度同名卡',`消耗 ${h.name} 1 张，兑换后不能撤回`,run);else run();
        },canConvert?palette.gold:palette.paperDark);
      }
      const inFormation=s.formation.includes(h.id);
      V.button('FormationAction',inFormation?'下 阵':'上 阵',0,top-1245,310,61,()=>{
        const formation=s.formation;
        if(inFormation){
          if(formation.filter(Boolean).length<=1)return ctx.tell({ok:false,msg:'至少保留一名上阵武将'},'');
          store.setFormationSlot(formation.indexOf(h.id),null);
        }else{
          const empty=formation.indexOf(null);
          if(empty<0){ctx.go('formation');return;}
          store.setFormationSlot(empty,h.id);
        }
        store.save();ctx.tell({ok:true},inFormation?'已下阵':'已上阵');
      },inFormation?palette.paperDark:palette.gold);
      if((s.vouchers[h.rarity===4?'ssr':'sr']||0)>0&&h.rarity>=3)
        V.button('UseVoucher','使用英雄自选券',0,top-1322,400,58,()=>ctx.confirm('使用自选券',`选择 ${h.name}，获得该武将一张`,()=>ctx.tell(store.useChoiceVoucher(h.rarity,h.id),`获得 ${h.name}`)),palette.gold);
    });
  }

export function summon(ctx: ScreenContext) {
    const s=store.getState(),U=ctx.ui;
    U.rect('SummonBackdrop',0,0,720,1280,ink);
    U.text('SummonBack','‹ 返回',-291,616,130,22,gold);
    U.tap('SummonBackTap',-291,616,136,45,()=>ctx.back('home'));
    U.panel('GemBalance',-175,566,334,42,ink,12,border);
    U.text('GemBalanceText',`元宝 ${fmt.fmtNum(s.res.gem)}`,-175,566,304,20,gold);
    U.panel('ScrollBalance',175,566,334,42,ink,12,border);
    U.text('ScrollBalanceText',`招募令 ${s.res.scroll}`,175,566,304,20,gold);
    U.panel('SummonHall',0,378,686,288,panel,13,gold);
    U.text('SummonHallTitle','召唤 · 点将台',0,478,600,42,gold);
    U.text('SummonHallSubtitle','聚天下英杰 · 成千秋霸业',0,431,590,20,dim);
    U.scene('SummonSealArt',g=>{
      g.strokeColor=tone('#765a30');g.lineWidth=3;g.circle(0,356,74);g.stroke();
      for(let i=0;i<12;i++){
        const a=i*Math.PI/6;
        g.moveTo(Math.cos(a)*84,356+Math.sin(a)*84);
        g.lineTo(Math.cos(a)*111,356+Math.sin(a)*111);
      }
      g.stroke();
    });
    U.panel('SummonSeal',0,356,72,72,tone('#57402d'),10,gold);
    U.text('SummonSealText','将',0,356,68,42,gold);
    U.text('SummonRates','概率 SSR 2% · SR 10% · R 28% · N 60%',0,268,630,19,dim);
    U.panel('SummonPool',0,199,686,110,panel,9,border);
    U.text('PoolTitle',`武将池 · ${heroData.HEROES.length} 将 · 固定概率，无保底`,-73,231,590,19,dim);
    const rarity:[string,string,number][]=[['SSR','#e2b95f',4],['SR','#b37ac9',3],['R','#5f90c8',2],['N','#b9bec3',1]];
    rarity.forEach(([name,hex],i)=>{
      const x=-264+i*175;
      U.panel('RarityMark'+i,x-47,190,19,19,tone(hex),2);
      U.text('RarityName'+i,name,x+4,190,83,20,tone(hex));
    });
    U.text('PoolCounts',rarity.map(([name,,level])=>`${name} ${heroData.HEROES.filter((h:any)=>h.rarity===level).length}`).join(' · '),0,163,610,17,dim);
    const draws:[string,string,string,string,()=>void][]=[
      ['Single','招募 ×1','招募令 ×1','#392719',()=>ctx.confirm('确认招募','消耗招募令 ×1',()=>ctx.summonDraw('scroll1'))],
      ['TenScroll','招募 ×10','招募令 ×10','#d9ac5f',()=>ctx.confirm('确认招募','消耗招募令 ×10',()=>ctx.summonDraw('scroll10'))],
      ['TenGem','元宝十连',`元宝 ×${config.GACHA.costTenGold}`,'#d9ac5f',()=>ctx.confirm('确认招募',`消耗元宝 ×${config.GACHA.costTenGold}`,()=>ctx.summonDraw('gem10'))]
    ];
    draws.forEach(([id,title,cost,hex,action],i)=>{
      const x=-232+i*232,bg=tone(hex),dark=i===0;
      U.panel(id,x,74,214,88,bg,9,gold);
      U.text(id+'Title',title,x,93,194,27,dark?gold:ink);
      U.text(id+'Cost',cost,x,54,194,17,dark?dim:tone('#573d1e'));
      U.tap(id+'Tap',x,74,214,88,action);
    });
    U.panel('SummonAd',0,-7,678,51,tone('#2b1e12'),8,border);
    U.text('SummonAdText','看广告得招募令 ×1',0,-7,618,20,gold);
    U.tap('SummonAdTap',0,-7,678,51,()=>ctx.playAd('summon',()=>{
      store.applyReward({scroll:1});store.save();ctx.tell({ok:true},'获得招募令 ×1');
    }));
  }

export function summonDraw(ctx: ScreenContext, type: string) {
    const r=store.doSummon(type);
    if (!r.ok) return ctx.tell(r, '');
    ctx.lastSummon = r.results;
    ctx.go('summonResults');
  }

export function summonResults(ctx: ScreenContext) {
    const U=ctx.ui;
    U.rect('ResultBackdrop',0,0,720,1280,ink);
    U.text('DrawBack','‹ 返回点将台',-254,609,205,21,gold);
    U.tap('DrawBackTap',-254,609,205,45,()=>ctx.back('summon'));
    U.panel('DrawResultFrame',0,-10,690,1060,panel,13,gold);
    U.text('DrawHeading',`召唤结果 · ${ctx.lastSummon.length} 名英雄`,0,469,630,33,gold);
    U.text('DrawSubheading','新英雄直接入队；抽到重复武将自动升星，无需铜钱',0,425,630,18,dim);
    ctx.lastSummon.forEach((result: any, i: number) => {
      const hero = heroData.getHero(result.id);
      if (!hero) return;
      const cols=Math.min(3,ctx.lastSummon.length);
      const x=-(cols-1)*111+(i%cols)*222;
      const y=ctx.lastSummon.length===1?70:313-Math.floor(i/cols)*207;
      const rarity=rarityNames[hero.rarity]||'N';
      const openHero = () => {ctx.selectedHeroId=result.id;ctx.go('heroDetail');};
      const single=ctx.lastSummon.length===1;
      const accent=tone(rarityColors[hero.rarity]);
      U.panel('DrawCard'+i,x,y,single?350:205,single?420:193,panel,9,accent);
      U.panel('DrawAvatar'+i,x,single?y+54:y+38,single?214:135,single?220:98,tone('#364539'),8,accent);
      U.text('DrawGlyph'+i,hero.surname||hero.name[0],x,single?y+54:y+38,single?150:93,single?89:63,paper);
      U.text('DrawName'+i,hero.name,x,single?y-78:y-35,single?290:180,single?30:23,paper);
      U.text('DrawRarity'+i,rarity,x,single?y-120:y-63,single?210:154,20,accent);
      U.text('DrawStatus'+i,result.isNew?'NEW':result.autoStar?`★${result.fromStar}→${result.star}`:`留存 ×${result.cards||1}`,x,single?y-157:y-83,single?235:162,17,dim);
      U.tap('DrawCardTap'+i,x,y,single?350:205,single?420:193,openHero);
    });
    U.panel('DrawContinue',-169,-478,298,62,tone('#d9a94e'),9,gold);
    U.text('DrawContinueText','继续招募',-169,-478,275,23,ink);
    U.tap('DrawContinueTap',-169,-478,298,62,()=>ctx.go('summon'));
    U.panel('DrawRoster',169,-478,298,62,tone('#3d6653'),9,gold);
    U.text('DrawRosterText','查看群英',169,-478,275,23,paper);
    U.tap('DrawRosterTap',169,-478,298,62,()=>ctx.go('heroes'));
  }

export function armory(ctx: ScreenContext) {
    const s=store.getState(),U=ctx.ui;
    const recs:any[]=progression.getArmoryRecommendations(s,items);
    const unlocked=items.CATALOG.filter((item:any)=>s.armory.unlocked[item.id]).length;
    ctx.title('全军军械');
    U.text('ArmoryBack','‹ 返回',-291,484,130,22,gold);
    U.tap('ArmoryBackTap',-291,484,136,52,()=>ctx.back('home'));
    U.panel('ArmoryIron',-175,409,334,42,ink,10,border);
    U.text('ArmoryIronText',`精铁 ${fmt.fmtNum(s.res.iron)}`,-175,409,310,19,gold);
    U.panel('ArmoryCoins',175,409,334,42,ink,10,border);
    U.text('ArmoryCoinsText',`铜钱 ${fmt.fmtNum(s.res.gold)}`,175,409,310,19,gold);
    chip(U,'ArmoryOverviewTab','部位养成',-171,345,334,true,()=>ctx.show('armory'));
    chip(U,'ArmoryCatalogTab',`装备图鉴  ${unlocked}/${items.CATALOG.length}`,171,345,334,false,()=>ctx.go('armoryCatalog'));
    U.text('ArmoryIntro','一套军械，全体英雄同时生效',0,279,620,20,dim);
    if(recs.length){
      U.panel('ArmoryRecommend',0,220,610,49,tone('#d9a94e'),7,gold);
      U.text('ArmoryRecommendText',`免费启用推荐 · ${recs.length} 个部位`,0,220,586,20,ink);
      U.tap('ArmoryRecommendTap',0,220,610,49,()=>{
        ctx.confirm('免费启用军械建议',recs.map(r=>`${r.slotName}：${r.fromName} → ${r.toName}`).join('；'),()=>ctx.tell(store.applyArmoryRecommendations(recs),`已为全军启用 ${recs.length} 件`));
      });
    }
    const top=recs.length?156:203,cardH=205,pitch=219;
    const viewTop=top+cardH/2,viewBottom=-499,viewH=viewTop-viewBottom;
    const contentH=Math.max(viewH,3*pitch+190);
    U.scroll('ArmoryOverviewScroll',0,(viewTop+viewBottom)/2,700,viewH,contentH,V=>{
      items.ARMORY_SLOTS.forEach((slot:any,i:number)=>{
        const selected:any=items.CATALOG.find((item:any)=>item.id===s.armory.selected[slot.id]);
        const x=i%2?170:-170,y=contentH/2-cardH/2-Math.floor(i/2)*pitch;
        V.panel('ArmorySlotCard'+i,x,y,324,cardH,panel,9,gold);
        V.text('ArmorySlotName'+i,slot.name,x-71,y+72,155,25,gold);
        V.text('ArmorySlotStar'+i,`★${s.armory.slotStars[slot.id]||0}`,x+115,y+72,62,21,gold);
        V.text('ArmorySlotItem'+i,selected?.name||'尚未选择军械',x,y+27,295,22,selected?tone(items.GRADES[selected.q].color):dim);
        if(selected){
          V.text('ArmorySlotStats'+i,`${items.GRADES[selected.q].name} · ${armoryStats(selected.basePct||selected.stats)}`,x,y-10,296,17,dim);
          if(selected.effect)V.text('ArmorySlotEffect'+i,armoryEffect(selected.effect),x,y-41,296,16,dim);
        }
        V.panel('ArmorySlotOpen'+i,x,y-73,295,43,tone('#39291a'),5,border);
        V.text('ArmorySlotOpenText'+i,'查看图鉴',x,y-73,270,18,gold);
        V.tap('ArmorySlotTap'+i,x,y,324,cardH,()=>{ctx.selectedArmorySlot=slot.id;CocosUi.resetScroll('CatalogScroll');ctx.go('armoryCatalog');});
      });
      const bonus:any=store.getArmoryBonuses(),summaryY=contentH/2-3*pitch-42;
      V.panel('ArmoryTotal',0,summaryY,680,103,panel,9,border);
      V.text('ArmoryTotalTitle','全军属性与战术效果',-171,summaryY+26,316,22,gold);
      V.text('ArmoryTotalStats',armoryStats(bonus),0,summaryY-19,643,18,dim);
      V.text('ArmoryHelp','重复获得的军械会转为精铁；部位升星后，全体英雄共同受益。',0,summaryY-77,660,18,dim);
    });
  }

export function armoryCatalog(ctx: ScreenContext) {
    const s=store.getState(),U=ctx.ui,slot=items.ARMORY_SLOTS.find((x:any)=>x.id===ctx.selectedArmorySlot);
    const star=s.armory.slotStars[ctx.selectedArmorySlot]||0,slotItems:any[]=items.CATALOG.filter((item:any)=>item.slot===ctx.selectedArmorySlot);
    if(!armoryItemId||!slotItems.some(item=>item.id===armoryItemId))armoryItemId=s.armory.selected[ctx.selectedArmorySlot]||slotItems[0]?.id||'';
    const item:any=slotItems.find(item=>item.id===armoryItemId),unlocked=items.CATALOG.filter((entry:any)=>s.armory.unlocked[entry.id]).length;
    ctx.title('全军军械');
    U.text('CatalogBack','‹ 返回',-291,484,130,22,gold);
    U.tap('CatalogBackTap',-291,484,136,52,()=>ctx.back('armory'));
    U.panel('CatalogIron',-175,409,334,42,ink,10,border);
    U.text('CatalogIronText',`精铁 ${fmt.fmtNum(s.res.iron)}`,-175,409,310,19,gold);
    U.panel('CatalogCoins',175,409,334,42,ink,10,border);
    U.text('CatalogCoinsText',`铜钱 ${fmt.fmtNum(s.res.gold)}`,175,409,310,19,gold);
    chip(U,'CatalogOverviewTab','部位养成',-171,345,334,false,()=>ctx.go('armory'));
    chip(U,'CatalogSelectedTab',`装备图鉴  ${unlocked}/${items.CATALOG.length}`,171,345,334,true,()=>ctx.show('armoryCatalog'));
    const contentH=1450,viewH=840;
    U.scroll('CatalogScroll',0,-126,704,viewH,contentH,V=>{
      const top=contentH/2;
      items.ARMORY_SLOTS.forEach((entry:any,i:number)=>{
        const x=-224+(i%3)*224,y=top-40-Math.floor(i/3)*61;
        chip(V,'CatalogSlot'+i,entry.name,x,y,207,entry.id===ctx.selectedArmorySlot,()=>{
          ctx.selectedArmorySlot=entry.id;armoryItemId=s.armory.selected[entry.id]||items.CATALOG.find((it:any)=>it.slot===entry.id)?.id||'';CocosUi.resetScroll('CatalogScroll');ctx.show('armoryCatalog');
        });
      });
      V.text('CatalogSlotTitle',`${slot?.name||''} · 部位 ★${star}`,-183,top-164,365,22,gold);
      V.button('CatalogUpgrade','部位升星',228,top-164,200,49,()=>{
        if(star>=items.STAR_NEEDS.length)return ctx.tell({ok:false,msg:'部位已满星'},'');
        ctx.confirm('部位升星确认',`当前 ★${star} → ★${star+1}；消耗精铁 ${items.STAR_NEEDS[star]}、铜钱 ${fmt.fmtNum(items.STAR_GOLD[star])}`,()=>ctx.tell(store.armoryUpgrade(ctx.selectedArmorySlot),'部位升星成功'));
      },palette.gold);
      slotItems.forEach((entry:any,i:number)=>{
        const y=top-226-i*78,selected=entry.id===armoryItemId,active=s.armory.selected[entry.slot]===entry.id,owned=!!s.armory.unlocked[entry.id];
        V.panel('CatalogItem'+i,0,y,680,67,selected?tone('#45321b'):panel,7,selected?gold:border);
        V.text('CatalogItemName'+i,entry.name,-205,y+16,261,20,tone(items.GRADES[entry.q].color));
        V.text('CatalogItemMeta'+i,`${items.GRADES[entry.q].name} · ${armoryStats(entry.basePct||entry.stats)} · ${active?'全军启用':owned?'已解锁':'未解锁'}`,-28,y-16,617,16,dim);
        V.tap('CatalogItemTap'+i,0,y,680,67,()=>{armoryItemId=entry.id;ctx.show('armoryCatalog');});
      });
      const afterList=top-226-slotItems.length*78-18;
      V.text('CatalogOdds','战役首通有机会掉落军械；更高品质随关卡解锁',0,afterList,658,16,dim);
      const boxes=[1,2,3].map(q=>s.armory.boxes[q]||0);
      if(boxes.some(Boolean)){
        V.text('CatalogBoxesTitle','待选择的军械箱',-219,afterList-52,238,20,gold);
        [1,2,3].forEach((q,i)=>chip(V,'CatalogBox'+q,`${items.GRADES[q].name}箱 ×${boxes[i]}`,-224+i*224,afterList-102,207,false,()=>{ctx.selectedBoxQ=q;ctx.go('armoryBox');}));
      }
      const detailY=boxes.some(Boolean)?afterList-300:afterList-169;
      if(item){
        V.panel('CatalogDetail',0,detailY,680,275,panel,10,gold);
        V.text('CatalogDetailName',item.name,-199,detailY+104,275,27,tone(items.GRADES[item.q].color));
        V.text('CatalogDetailType',`${slot?.name} · ${items.GRADES[item.q].name} · 部位 ★${star}`,-173,detailY+66,345,19,dim);
        V.text('CatalogDetailStats',`基础加成：${armoryStats(item.basePct||item.stats)}`,0,detailY+29,636,19,gold);
        if(item.effect)V.text('CatalogDetailEffect',`效果：${armoryEffect(item.effect)}`,0,detailY-6,636,17,paper);
        V.text('CatalogDetailSource',item.q===0?'获得：新手赠送与战役奖励':`获得：战役奖励；通关第 ${items.GRADES[item.q].unlockStage} 关后可用精铁定向解锁`,0,detailY-40,636,17,dim);
        const owned=!!s.armory.unlocked[item.id],active=s.armory.selected[item.slot]===item.id;
        const ready=s.campaign.cleared>=items.GRADES[item.q].unlockStage;
        V.button('CatalogDetailAction',active?'全军正在使用':owned?'全军启用':ready?`精铁 ×${items.GRADES[item.q].cost} 解锁`:`通关第 ${items.GRADES[item.q].unlockStage} 关后开放`,0,detailY-96,629,52,()=>{
          if(active)return;
          if(owned)return ctx.tell(store.armorySelect(item.slot,item.id),`已为全军启用 ${item.name}`);
          if(!ready)return ctx.tell({ok:false,msg:'尚未满足关卡条件'},'');
          ctx.confirm('解锁军械确认',`${item.name} · 消耗精铁 ×${items.GRADES[item.q].cost}`,()=>ctx.tell(store.armoryUnlock(item.id),`已解锁 ${item.name}`));
        },active?palette.paperDark:palette.gold);
      }
    });
  }

export function armoryBox(ctx: ScreenContext) {
  const s=store.getState(), q=ctx.selectedBoxQ, count=s.armory.boxes[q]||0,U=ctx.ui;
  const pool:any[]=items.CATALOG.filter((item:any)=>item.q===q);
  ctx.title('军械自选箱',`${items.GRADES[q].name}箱 ×${count} · 选择尚未解锁的军械`);
  U.text('BoxBack','‹ 返回图鉴',-271,484,170,20,gold);
  U.tap('BoxBackTap',-271,484,170,50,()=>ctx.back('armoryCatalog'));
  [1,2,3].forEach((grade,i)=>chip(U,'BoxGrade'+grade,`${items.GRADES[grade].name} ×${s.armory.boxes[grade]||0}`,-224+i*224,363,209,grade===q,()=>{ctx.selectedBoxQ=grade;CocosUi.resetScroll('ArmoryBoxItems');ctx.show('armoryBox');}));
  const rows=Math.ceil(pool.length/3),pitch=157,viewH=805,contentH=Math.max(viewH,rows*pitch+30);
  U.scroll('ArmoryBoxItems',0,-85,701,viewH,contentH,V=>{
    pool.forEach((item:any,i:number)=>{
      const owned=!!s.armory.unlocked[item.id],x=-225+(i%3)*225,y=contentH/2-79-Math.floor(i/3)*pitch;
      V.panel('BoxItem'+i,x,y,209,145,owned?tone('#29231a'):panel,8,owned?border:tone(items.GRADES[q].color));
      V.text('BoxItemName'+i,item.name,x,y+40,185,22,owned?dim:gold);
      V.text('BoxItemSlot'+i,items.ARMORY_SLOTS.find((slot:any)=>slot.id===item.slot)?.name||'',x,y+4,182,17,dim);
      V.text('BoxItemStatus'+i,owned?'已解锁':count>0?'可选择':'无箱',x,y-42,182,19,owned?dim:paper);
      V.tap('BoxItemTap'+i,x,y,209,145,()=>{
        if(owned)return ctx.tell({ok:false,msg:'该军械已经解锁'},'');
        if(count<=0)return ctx.tell({ok:false,msg:'当前品质没有可使用的军械箱'},'');
        ctx.confirm('使用军械自选箱',`消耗 ${items.GRADES[q].name}箱 ×1，获得 ${item.name}`,
          ()=>ctx.tell(store.armoryClaimBox(q,item.id),`已解锁 ${item.name}`));
      });
    });
  });
  if(count>0&&pool.every((item:any)=>s.armory.unlocked[item.id]))
    U.button('BoxConvert','图鉴已齐 · 转为精铁',0,-539,482,56,()=>ctx.confirm('转换军械箱',
      `将 ${items.GRADES[q].name}箱 ×1 转为精铁`,()=>ctx.tell(store.armoryClaimBox(q,'convert'),'已转换精铁')),palette.gold);
}
