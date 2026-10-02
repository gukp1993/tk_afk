import { CocosUi, factionColors, palette, hexColor as tone, rarityColors } from '../ui/CocosUi';
import { Color, Node } from 'cc';
import { ScreenContext } from './ScreenContext';
import * as store from '../domain/store';
import * as heroData from '../domain/heroes';
import * as items from '../domain/items';
import * as config from '../domain/config';
import * as stages from '../domain/stages';
import * as fmt from '../domain/fmt';
import * as progression from '../domain/progression';
import { firstTimeOverlay } from './TutorialOverlay';
import * as bios from '../domain/bios';

let trialPreviewHero = ''; // 名将试炼预览弹层当前对象（C2）
const ink=tone('#171009'), panel=tone('#2e2113'), border=tone('#5a452a');
const gold=tone('#f0cf8a'), paper=tone('#e9d8b4'), dim=tone('#a6906c');
const rarityNames=['','N','R','SR','SSR'];
const LIGHT=tone('#e9d8b4');
let univPickOpen = false;
const factions:[string,string][]=[['all','全部'],['wei','魏'],['shu','蜀'],['wu','吴'],['qun','群']];
const sorts:[string,string][]=[['power','战力'],['rarity','品质'],['star','星级']];
const previewIds = ['zhaoyun','caocao','zhouyu','diaochan','zhugeliang'];
let heroFaction='all',heroSort='power',showStarterPick=false,shardTier=0;
let armoryItemId='';

function chip(U: ScreenContext['ui'], name:string, label:string, x:number,y:number,w:number,active:boolean,action:()=>void) {
    U.panel(name,x,y,w,48,active?tone('#3a2a1b'):ink,24,active?gold:border);
    U.text(name+'Text',label,x,y,w-8,20,active?gold:dim);
    U.tap(name+'Tap',x,y,w,48,action);
}

function armoryStats(stats: Record<string,any>|undefined) {
  const names:{[key:string]:string}={atk:'攻击',hp:'生命',def:'防御',spdPct:'速度'};
  return Object.entries(stats||{}).filter(([key,value])=>names[key]&&Number(value)).map(([key,value])=>`${names[key]} +${fmt.fmtPct(Number(value))}`).join(' · ')||'暂无属性加成';
}
function armoryEffect(effect: string|null|undefined) {
  return ({heal:'主动治疗与持续治疗效果提升',shield:'战斗开始时为全体英雄提供护盾',energy:'战斗开始时增加全体英雄怒气',reduction:'降低全体英雄受到的直接伤害'} as {[key:string]:string})[effect||'']||'';
}
function rarityMax(r:number){return (config.RARITIES as any)[r]?.maxStar||5;}
function nodeValText(stat:string,value:number){return stat==='startEnergy'?`+${value}`:`+${fmt.fmtPct(value)}`;}
function nodeLineText(slotId:string,star:number){
  const n=items.slotNodeInfo(slotId,star);
  if(!n)return '';
  if(n.maxed)return '已满星 · 节点已增强';
  if(n.tier===0)return `${n.next!.star}★解锁：${n.label} ${nodeValText(n.stat,n.next!.value)}`;
  return `已解锁 ${n.label} ${nodeValText(n.stat,n.current)} · ${n.next!.star}★增强为 ${nodeValText(n.stat,n.next!.value)}`;
}

export function heroes(ctx: ScreenContext) {
    const U=ctx.ui,s=store.getState();
    const allHeroes:any[]=store.allRoster();
    let owned=allHeroes.filter((h:any)=>heroData.getHero(h.id));
    if(heroFaction!=='all')owned=owned.filter((h:any)=>h.faction===heroFaction);
    const stableId=(a:any,b:any)=>a.id<b.id?-1:a.id>b.id?1:0;
    owned.sort((a:any,b:any)=>{
      const primary=heroSort==='rarity'?b.rarity-a.rarity:heroSort==='star'?b.star-a.star:b.power-a.power;
      if(primary)return primary;
      const second=heroSort==='rarity'?b.star-a.star:heroSort==='star'?b.rarity-a.rarity:b.rarity-a.rarity;
      if(second)return second;
      if(heroSort==='power'&&b.star!==a.star)return b.star-a.star;
      if(heroSort!=='power'&&b.power!==a.power)return b.power-a.power;
      return stableId(a,b);
    });
    const ownedIds=new Set(allHeroes.map((h:any)=>h.id));
    const previews=previewIds.map(id=>heroData.getHero(id)).filter((h:any)=>h&&!ownedIds.has(h.id)&&(heroFaction==='all'||h.faction===heroFaction))
      .slice(0,heroFaction==='all'?Math.max(0,9-owned.length):3).map((h:any)=>({...h,star:0,locked:true}));
    const list=[...owned,...previews];
    U.rect('HeroBackdrop',0,0,720,1280,tone('#122a22'));
    const resourcePills:[string,number][]=[['铜钱',s.res.gold],['元宝',s.res.gem]];
    resourcePills.forEach(([label,value],i)=>{
      const x=i===0?60:250;
      U.panel('HeroResource'+i,x,608,179,44,new Color(19,32,27,240),22,gold);
      U.seal('HeroResourceIcon'+i,x-64,608,33,i===0?'钱':'宝',palette.ink,palette.gold,palette.gold,Math.round(33*0.5),i===0?'gold':'gem');
      U.text('HeroResourceText'+i,`${label} ${fmt.fmtNum(value)}`,x+14,608,133,21,paper);
    });
    U.text('HeroesTitle','群英录',-225,577,267,61,gold);
    U.panel('HeroesFormation',260,515,184,63,new Color(96,70,37,239),8,gold);
    U.seal('HeroesFormationIcon',197,515,43,'阵',palette.ink,palette.gold,palette.gold,21,'formation');
    U.text('HeroesFormationText','调整编队',281,515,136,25,paper);
    U.tap('HeroesFormationTap',260,515,184,63,()=>ctx.go('formation'));
    const first=store.firstWinChoice().available;
    if(first){
      U.panel('StarterReward',22,515,230,63,tone('#d9a94e'),7,gold);
      U.text('StarterRewardText','首胜升星待选',22,515,213,23,ink);
      U.tap('StarterRewardTap',22,515,230,63,()=>{showStarterPick=true;ctx.show('heroes');});
    }else{
      const qs=store.qualityShardInfo();
      U.panel('ShardEntry',22,515,230,63,tone('#3a2a1b'),7,gold);
      U.text('ShardEntryText','碎片兑换 ›',22,529,213,22,gold);
      U.text('ShardEntrySub',`SSR${qs[4]} SR${qs[3]} R${qs[2]} N${qs[1]} 各/10`,34,500,206,14,dim);
      U.tap('ShardEntryTap',22,515,230,63,()=>{shardTier=4;ctx.show('heroes');});
    }
    const sharedY=455,filterY=378,sortY=303;
    U.panel('HeroOwnedPanel',0,sharedY,720,66,new Color(14,32,28,240),0,gold);
    U.text('HeroSharedLevel',`主公 Lv.${store.playerLevel()} · 全体武将共享等级`,-134,sharedY,442,25,paper);
    U.text('HeroOwned',`已拥有 ${allHeroes.length} / ${heroData.HEROES.length}`,261,sharedY,183,24,gold);
    const factionXs=[-280,-140,0,140,280];
    factions.forEach(([key,label],i)=>{
      const x=factionXs[i],active=key===heroFaction;
      if(active)U.panel('FactionActive'+key,x,filterY,79,79,new Color(35,48,38,145),39,gold);
      U.seal('FactionBadge'+key,x,filterY,62,key==='all'?'全':label,tone(factionColors[key]||factionColors.all),active?gold:border,palette.text,25);
      U.text('FactionLabel'+key,label,x,filterY,60,24,active?gold:paper);
      U.tap('FactionTap'+key,x,filterY,116,82,()=>{if(key===heroFaction)return;heroFaction=key;CocosUi.resetScroll('HeroGrid');ctx.show('heroes');});
    });
    sorts.forEach(([key,label],i)=>{
      const x=-223+i*223,active=key===heroSort;
      U.panel('Sort'+key,x,sortY,210,53,active?new Color(120,83,38,252):new Color(15,31,27,248),6,active?gold:border);
      U.text('SortText'+key,label+(active?' ↓':''),x,sortY,188,23,active?gold:paper);
      U.tap('SortTap'+key,x,sortY,210,53,()=>{if(key===heroSort)return;heroSort=key;CocosUi.resetScroll('HeroGrid');ctx.show('heroes');});
    });
    const scrollTop=sortY-39, scrollBottom=-510,viewH=scrollTop-scrollBottom;
    const rows=Math.ceil(list.length/3),pitch=310,contentH=Math.max(viewH,rows*pitch+16);
    U.scroll('HeroGrid',0,(scrollTop+scrollBottom)/2,696,viewH,contentH,grid=>{
      list.forEach((h:any,i:number)=>{
        const x=-225+(i%3)*225,y=contentH/2-151-Math.floor(i/3)*pitch;
        const data=heroData.getHero(h.id),rarity=data?.rarity||h.rarity||1;
        const accent=tone(rarityColors[rarity]);
        grid.panel('HeroCard'+i,x,y,216,298,new Color(18,34,29,255),2,accent);
        grid.heroIcon('HeroCardArt'+i,x,y,208,286,{surname:data?.surname||h.name[0],faction:h.faction,rarity,locked:!!h.locked,formed:s.formation.includes(h.id),artKey:h.id});
        grid.panel('HeroCardNameShade'+i,x,y-109,206,72,new Color(10,22,20,226),0);
        grid.panel('HeroFaction'+i,x-78,y+119,51,51,tone(factionColors[h.faction]||factionColors.all),26,gold);
        grid.text('HeroFactionLabel'+i,({wei:'魏',shu:'蜀',wu:'吴',qun:'群'} as any)[h.faction]||'?',x-78,y+119,45,23,paper);
        grid.text('HeroCardRarity'+i,rarityNames[rarity],x+73,y+73,64,23,accent);
        grid.text('HeroCardName'+i,h.name,x,y-94,188,27,paper);
        const maxStar=(config.RARITIES?.[rarity]?.maxStar)||5;
        grid.text('HeroCardStars'+i,h.locked?'☆'.repeat(maxStar):'★'.repeat(h.star||0)+'☆'.repeat(Math.max(0,maxStar-(h.star||0))),x,y-126,190,h.locked?18:20,h.locked?dim:gold);
        grid.tap('HeroCardTap'+i,x,y,216,298,()=>{if(h.locked){ctx.go('summon');return;}ctx.selectedHeroId=h.id;ctx.heroDetailOrigin='heroes';CocosUi.resetScroll(`HeroDetail:${h.id}`);ctx.go('heroDetail');});
      });
      if(!owned.length&&heroFaction!=='all'){
        grid.text('EmptyFactionHint','本阵营暂无已拥有武将 · 轻触剪影前往召唤',0,-contentH/2+40,640,20,dim);
      }else if(!list.length){
        grid.text('EmptyHeroes',heroFaction==='all'?'尚未获得武将':'尚未拥有这个阵营的武将',0,contentH/2-95,620,23,dim);
        grid.button('EmptySummon','前往召唤',0,contentH/2-175,250,72,()=>ctx.go('summon'),palette.gold);
      }
    });
    U.text('HeroGrowthHint','◆  重复获得同名武将，自动升星  ◆',0,-540,595,21,paper);
    if(showStarterPick&&first){
      U.rect('StarterMask',0,0,720,1280,tone('#171009')).on(Node.EventType.TOUCH_END,()=>{showStarterPick=false;ctx.show('heroes');});
      U.panel('StarterPanel',0,0,660,444,panel,14,gold);
      U.text('StarterHeading','首胜奖励 · 选择一名武将升星',0,164,620,27,gold);
      ['liubei','guanyu','zhangfei'].forEach((id,i)=>{
        const h:any=heroData.getHero(id),x=-213+i*213;
        U.panel('StarterCard'+i,x,6,190,245,tone('#332518'),9,gold);
        U.heroIcon('StarterFace'+i,x,43,125,121,{surname:h.surname||h.name[0],faction:h.faction,rarity:h.rarity,artKey:h.id});
        U.text('StarterName'+i,h.name,x,-43,160,24,paper);
        U.button('StarterChoose'+i,'选择',x,-83,150,50,()=>{showStarterPick=false;ctx.tell(store.claimFirstWinChoice(id),`${h.name} 自动升星`);},palette.gold);
      });
    }
    if(shardTier){
      const qs=store.qualityShardInfo();
      U.rect('ShardMask',0,0,720,1280,ink).on(Node.EventType.TOUCH_END,()=>{shardTier=0;ctx.show('heroes');});
      U.panel('ShardPanel',0,-10,664,1000,panel,14,gold);
      U.tap('ShardBlock',0,-10,664,1000,()=>{});
      U.text('ShardHeading','品质碎片兑换',0,438,600,30,gold);
      U.text('ShardHint','同品质碎片 10 片兑换该品质任意武将 1 张：未拥有直接解锁，未满星自动升星，已满星武将不可兑换',0,399,590,16,dim);
      ['N','R','SR','SSR'].forEach((name,i)=>{
        const tier=i+1,x=-243+i*162,active=shardTier===tier;
        U.panel('ShardTier'+tier,x,340,150,56,active?tone('#45321b'):ink,8,active?gold:border);
        U.text('ShardTierText'+tier,`${name} ${qs[tier]}/10`,x,340,140,20,active?gold:paper);
        U.tap('ShardTierTap'+tier,x,340,150,56,()=>{shardTier=tier;ctx.show('heroes');});
      });
      const pool=heroData.HEROES.filter((h:any)=>h.rarity===shardTier);
      const cols=3,pitch=190,ch=196,rows=Math.ceil(pool.length/cols);
      const gridH=Math.max(560,rows*ch+16);
      U.scroll('ShardGrid',0,-158,616,700,gridH,(V)=>{
        pool.forEach((h:any,i:number)=>{
          const x=-201+(i%cols)*201,y=gridH/2-103-Math.floor(i/cols)*ch;
          const own=store.getOwned(h.id),maxed=own&&own.star>=rarityMax(h.rarity),can=qs[shardTier]>=10;
          V.panel('ShardCard'+i,x,y,184,184,tone('#322319'),8,own?gold:border);
          V.heroIcon('ShardFace'+i,x,y+42,150,100,{surname:h.name[0],faction:h.faction,rarity:h.rarity,artKey:h.id});
          V.text('ShardName'+i,h.name,x,y-18,166,21,paper);
          V.text('ShardState'+i,!own?'可解锁':maxed?'已满星 · 返1片':'可升星 ★'+(own.star+1),x,y-44,166,16,maxed?dim:(can?gold:tone('#ad9977')));
          V.tap('ShardTap'+i,x,y,184,184,()=>{
            if(qs[shardTier]<10)return ctx.tell({ok:false,msg:'同品质碎片不足 10 片'},'');
            ctx.confirm('碎片兑换',`消耗 ${['','N','R','SR','SSR'][shardTier]} 碎片 10 片，兑换 ${h.name}${maxed?'（已满星，兑换后返还 1 片）':''}`,()=>{
              const r=store.exchangeQualityShard(shardTier,h.id);
              ctx.tell(r,r.ok?`已兑换 ${h.name}`:'');
              ctx.show('heroes');
            });
          });
        });
      });
      U.button('ShardClose','关闭',0,-490,300,58,()=>{shardTier=0;ctx.show('heroes');},palette.paperDark);
    }
  }

// 兵法 perLevel 数值键的中文显示名（ult* 为必杀技乘区，其余为该将自身被动增量）
const TACTIC_KEY_NAMES:Record<string,string>={ultDmg:'必杀伤害',ultHeal:'必杀治疗',ultShield:'必杀护盾',ultDot:'必杀持续伤害',ultDebuff:'必杀削弱',atk:'攻击',hp:'生命',crit:'暴击率',critDmg:'暴击伤害',dmgReduce:'受伤降低',thorns:'反弹伤害',vamp:'吸血'};

export function heroDetail(ctx: ScreenContext) {
  const def:any=heroData.getHero(ctx.selectedHeroId), own:any=store.getOwned(ctx.selectedHeroId);
  if(!def||!own){ctx.notice='没有找到该武将或尚未拥有';ctx.back(ctx.heroDetailOrigin||'heroes');return;}
  const h:any=store.calcHero(ctx.selectedHeroId), U=ctx.ui, s=store.getState();
  const max=config.RARITIES[h.rarity].maxStar, bonus:any=store.getArmoryBonuses(), xp=store.playerXpNeeded(s.player.level);
  const faction:Record<string,string>={wei:'魏',shu:'蜀',wu:'吴',qun:'群'};
  const cls=(config.CLASSES as any)[h.cls]?.name||'武将', formed=s.formation.includes(h.id);
  const hasVoucher=(s.vouchers[h.rarity===4?'ssr':'sr']||0)>0&&h.rarity>=3;
  const awakenShown=h.rarity===4&&own.star>=5;
  const tacticShown=(h.rarity===4&&own.star>=5)||(h.rarity===3&&own.star>=4);
  const contentH=1160+(own.cards>0?110:0)+(hasVoucher?115:0)+(ctx.heroDetailOrigin==='heroes'?90:0)+(awakenShown?130:0)+(tacticShown?130:0)+(h.rarity<=2?130:0)+(h.rarity===4&&(config.TRIALS as any).enabled?96:0);
  const top=contentH/2, pct=(v:number)=>fmt.fmtPct(v);
  U.rect('DetailBackdrop',0,0,720,1280,tone('#122a22'));
  U.panel('DetailHeader',0,587,720,96,new Color(9,28,25,245),0,gold);
  U.text('DetailBackIcon','‹',-306,587,40,38,gold);U.text('DetailHeading','武将详情',-154,587,270,39,gold);
  U.tap('DetailBackTap',-288,587,106,88,()=>ctx.back(ctx.heroDetailOrigin||'heroes'));
  U.seal('DetailGoldIcon',150,587,33,'钱',palette.ink,palette.gold,palette.gold,16,'gold');U.text('DetailGold',fmt.fmtNum(s.res.gold),205,587,94,22,paper);
  U.seal('DetailGemIcon',268,587,33,'宝',palette.ink,palette.gold,palette.gold,16,'gem');U.text('DetailGem',fmt.fmtNum(s.res.gem),320,587,76,22,paper);
  U.scroll('HeroDetail:'+h.id,0,8,708,1044,contentH,V=>{
    V.panel('DetailStage',0,top-140,684,260,new Color(16,30,25,170),12,border);
    V.heroIcon('DetailPortrait',-240,top-140,170,220,{surname:h.surname||h.name[0],faction:h.faction,rarity:h.rarity,formed,artKey:h.id});
    V.text('DetailTitle',h.title||'武将',92,top-52,240,30,paper);
    V.text('DetailName',h.name,92,top-112,280,62,gold);
    V.text('DetailIdentity',(faction[h.faction]||h.faction)+' · '+cls,92,top-158,250,24,paper);
    if(h.quote&&!(bios.BIOS as any)[h.id])V.text('DetailQuote','「'+h.quote+'」',0,top-248,560,19,tone('#c9b489'));
    V.panel('DetailRarity',-52,top-210,139,48,new Color(147,98,37,248),5,gold);
    V.text('DetailRarityText',rarityNames[h.rarity],-52,top-210,131,30,gold);
    V.text('DetailStars','★'.repeat(own.star||0)+'☆'.repeat(Math.max(0,max-(own.star||0))),130,top-210,220,26,gold);
    V.panel('DetailStatus',0,top-305,660,70,new Color(12,34,30,240),5,gold);
    V.seal('DetailFormationIcon',-263,top-305,34,'阵',palette.ink,palette.gold,palette.gold,17,'formation');
    V.text('DetailLevel','全军共享 Lv.'+h.level,-140,top-305,262,25,paper);
    V.text('DetailFormationState',formed?'已上阵':'未上阵',232,top-305,150,25,formed?gold:dim);
    V.text('StatsHeading','武将属性',-242,top-375,195,29,gold);
    V.panel('StatsPanel',0,top-450,666,112,new Color(19,37,32,244),5,border);
    const statTones=[tone('#7fbd94'),tone('#bb614c'),tone('#4d91bd')];
    const stats:[string,string,string][]=[['生','生命',fmt.fmtNum(h.stats.hp)],['攻','攻击',fmt.fmtNum(h.stats.atk)],['防','防御',fmt.fmtNum(h.stats.def)]];
    stats.forEach(([glyph,label,value],i)=>{const x=-212+i*212;
      V.seal('StatIcon'+i,x-58,top-442,36,glyph,statTones[i],statTones[i],palette.ink,18);
      V.text('StatLabel'+i,label,x+13,top-424,118,22,paper);V.text('StatValue'+i,value,x+12,top-469,152,28,gold);});
    V.tap('StatsTap',0,top-450,666,112,()=>heroInfoModal(ctx,'详细属性',['战力：'+fmt.fmtNum(h.power),
      '生命：'+fmt.fmtNum(h.stats.hp)+'    攻击：'+fmt.fmtNum(h.stats.atk),'防御：'+fmt.fmtNum(h.stats.def)+'    攻速：'+h.stats.spd,
      '暴击：'+pct(h.stats.crit||0)+'    同名卡：'+(own.cards||0)+' 张','当前面板值仅供参考，战斗效果以实战结算为准。']));
    // 小传入口（研讨会六 C3）：台词行兼作按钮，有传记的将点击弹四句小传
    const bioLines=(bios.BIOS as any)[h.id];
    if(bioLines)V.tap('BioTap',0,top-248,684,26,()=>heroInfoModal(ctx,'武将小传 · '+h.name,bioLines));
    if(h.quote)V.text('DetailQuote','「'+h.quote+'」'+(bioLines?'  ·  小传 ›':''),0,top-248,560,19,tone('#c9b489'));
    V.text('SkillsHeading','武将技能',-242,top-535,195,29,gold);
    const skills=[{name:h.ult.name,desc:h.ult.desc,glyph:'杀',fill:palette.red,kind:'必杀技能'},
      {name:h.passiveDef.name,desc:h.passiveDef.desc,glyph:'守',fill:palette.green,kind:'被动技能'}];
    skills.forEach((skill,i)=>{const x=i===0?-169:169,y=top-673;V.panel('SkillTile'+i,x,y,328,216,new Color(19,38,33,247),7,gold);
      V.seal('SkillIcon'+i,x-115,y,84,skill.glyph,skill.fill,skill.fill,palette.text,40);
      V.textBlock('SkillName'+i,skill.name,x+50,y+65,190,48,26,gold);
      V.textBlock('SkillSummary'+i,skill.desc,x+50,y-20,190,108,18,paper);
      V.tap('SkillTap'+i,x,y,328,181,()=>heroInfoModal(ctx,skill.name,[skill.kind,skill.desc]));});
    V.panel('ArmoryBonusPanel',0,top-825,666,111,new Color(17,36,31,245),5,gold);
    V.seal('ArmoryWeapon',-275,top-825,48,'兵',tone('#bb614c'),tone('#bb614c'),palette.ink,24,'armory_weapon');
    V.seal('ArmoryArmor',-211,top-825,48,'甲',tone('#4d91bd'),tone('#4d91bd'),palette.ink,24,'armory_armor');
    V.seal('ArmoryJade',-146,top-825,48,'玉',tone('#7fbd94'),tone('#7fbd94'),palette.ink,24,'armory_jade');
    V.text('ArmoryHeading','全军军械',103,top-802,272,29,gold);
    V.text('ArmoryShared','一套军械，全体武将共享',106,top-836,331,21,paper);
    V.text('ArmoryBonus','攻击 +'+pct(bonus.atk)+' · 生命 +'+pct(bonus.hp)+' · 防御 +'+pct(bonus.def),106,top-860,340,18,dim);
    V.text('ArmoryChevron','›',292,top-825,30,30,dim);
    V.tap('HeroArmoryTap',0,top-825,666,111,()=>ctx.go('armory'));
    const gy=top-990;V.panel('GrowthPanel',0,gy,666,130,new Color(20,39,34,242),6,border);
    V.text('GrowthLevel','主公 Lv.'+s.player.level+' · 全体武将共享等级',-84,gy+37,480,23,gold);
    V.text('GrowthXP',xp?'当前经验 '+fmt.fmtNum(s.player.exp)+' / '+fmt.fmtNum(xp):'主公等级已达上限',-30,gy+7,570,20,dim);
    V.text('GrowthStar','重复获得'+h.name+'自动升星 · 当前 '+own.star+' / '+max+' 星',0,gy-26,625,22,paper);
    V.text('GrowthCardHint',own.star>=max?'已满星 · 多余同名卡可保留或兑换':'无需单独升级武将',0,gy-51,580,19,dim);
    let next=gy-118;
    if(own.cards>0){const cy=next-48;V.panel('ExtraCards',0,cy,660,84,new Color(27,39,32,238),8,border);
      V.text('ExtraCardsText',(own.star>=max?'满星后额外卡':'保留同名卡')+' '+own.cards+' 张'+(own.lockedCards?' · 已保护':''),-87,cy+21,424,18,gold);
      V.button('LockCards',own.lockedCards?'取消保护':'保护',237,cy+20,124,42,()=>{const r:any=store.setCardsLocked(h.id,!own.lockedCards);store.save();ctx.tell(r,r.locked?'同名卡已保护':'已取消保护');},palette.paperDark);
      const can=own.star>=max&&!own.lockedCards;V.button('ConvertCards',can?'兑换多余卡':'暂不可兑换',0,cy-20,280,41,()=>{
        if(!can)return ctx.tell({ok:false,msg:own.lockedCards?'请先取消保护':'满星后可兑换多余卡'},'');
        const run=()=>{const r:any=store.convertCards([{id:h.id,count:1,confirmHigh:h.rarity>=3}]);store.save();ctx.tell(r,'获得英雄碎片 ×'+(r.shards||0));};
        if(h.rarity>=3)ctx.confirm('兑换高稀有度同名卡','消耗 '+h.name+' 1 张，兑换后不能撤回',run);else run();},can?palette.gold:palette.paperDark);next=cy-78;}
    if(hasVoucher){V.button('UseVoucher','使用武将自选券',0,next-39,410,70,()=>ctx.confirm(
      '使用自选券','消耗对应品质自选券，获得 '+h.name+' 一张；重复获得按现有升星规则处理。',
      ()=>ctx.tell(store.useChoiceVoucher(h.rarity,h.id),'获得 '+h.name)),palette.gold);next-=104;}
    if(h.rarity===4&&own.star>=5){
      const aw=store.awakenInfo(h.id);
      const ay=next-64;
      V.panel('AwakenPanel',0,ay,666,108,new Color(46,32,20,242),8,gold);
      V.text('AwakenTitle',`觉醒 · ${aw.level}/${aw.max} 级（三维 +${Math.round(aw.mult*100)}%）`,-170,ay+28,440,22,gold);
      if(aw.next){
        const can=aw.next.can;
        V.text('AwakenCost',`下一级：荣耀 ${aw.next.honor} + SSR 碎片 ${aw.next.shards}`,-170,ay-10,430,17,dim);
        V.button('AwakenGo',can?'觉 醒':'材料不足',225,ay,180,54,()=>{const r:any=store.awakenHero(h.id);ctx.tell(r,r.ok?`${h.name} 觉醒至 ${r.level} 级（三维 +${Math.round(r.mult*100)}%）`:'');},can?palette.gold:palette.paperDark);
        if(!can)V.text('AwakenLack',own.star<5?'需先满 5 星':(store.getState().hall.honor<aw.next.honor)?'荣耀不足（名人堂获取）':'SSR 碎片不足（名人堂周全胜/成就 7~8 档获取)',-170,ay-38,430,15,tone('#bb614c'));
      } else {
        V.text('AwakenMax',`已达觉醒上限 · ${h.name} 已臻化境`,0,ay-14,600,19,tone('#d9b06a'));
      }
      next=ay-64;
    }
    if(tacticShown){
      const tc=store.tacticInfo(h.id) as any;
      if(tc&&tc.ok){
        const ty=next-64;
        const tactEffect=(level:number)=>Object.keys(tc.perLevel||{}).map((k:string)=>`${TACTIC_KEY_NAMES[k]||k} +${pct((tc.perLevel[k]||0)*level)}`).join(' · ')||'无';
        V.panel('TacticPanel',0,ty,666,108,new Color(24,36,48,242),8,gold);
        V.text('TacticTitle',`兵法 · ${tc.name} ${tc.level}/${tc.max} 级`,-170,ty+28,440,22,gold);
        V.tap('TacticInfoTap',0,ty,666,108,()=>heroInfoModal(ctx,'兵法 · '+tc.name,[tc.desc,
          '当前（'+tc.level+' 级）：'+(tc.level>0?tactEffect(tc.level):'未研习'),
          tc.next?('下一级（'+tc.next.level+' 级）：'+tactEffect(tc.next.level)):'已达上限',
          '将魂余额：'+tc.soul+'（满星 SSR 重复卡每张转 1 魂）']));
        if(tc.next){
          const can=tc.next.can;
          V.text('TacticCost',`下一级：将魂 ${tc.next.soul} + 铜钱 ${fmt.fmtNum(tc.next.gold)} · 余额 ${tc.soul}`,-170,ty-10,430,17,dim);
          V.button('TacticGo',can?'研 习':'材料不足',225,ty,180,54,()=>{const r:any=store.tacticUpgrade(h.id);ctx.tell(r,r.ok?`${h.name} 兵法「${r.name}」研习至 ${r.level} 级`:'');},can?palette.gold:palette.paperDark);
          if(!can)V.text('TacticLack',!tc.unlocked?'需先满 5 星':((s.res.soul||0)<tc.next.soul)?'将魂不足（满星后重复获得同名 SSR 转化）':'铜钱不足',-170,ty-38,430,15,tone('#bb614c'));
        } else {
          V.text('TacticMax',`已达兵法上限 · 「${tc.name}」大成`,0,ty-14,600,19,tone('#d9b06a'));
        }
        next=ty-64;
      }
    }
    // N/R 校场操练（研讨会三方案 1）：铜钱排水渠，效果只加该将悬赏派遣加成
    if(h.rarity<=2){
      const dr=store.drillInfo(h.id) as any;
      if(dr&&dr.ok){
        const dy=next-64;
        V.panel('DrillPanel',0,dy,666,108,new Color(30,40,24,242),8,gold);
        V.text('DrillTitle',`校场操练 · ${dr.level}/${dr.max} 级（悬赏加成 +${Math.round(dr.bonusPct*100)}%）`,-170,dy+28,470,22,gold);
        V.tap('DrillInfoTap',0,dy,666,108,()=>heroInfoModal(ctx,'校场操练',[
          '派遣该将执行悬赏时，该单铜钱与元宝奖励提升 '+Math.round(dr.bonusPct*100)+'%',
          '与阵营匹配加成（+20%）叠加，总加成封顶 +40%',
          '操练只影响悬赏收益，不改变战斗数值',
          '操练消耗铜钱——后期铜钱富余，正好用在编外将身上']));
        if(dr.nextCost!=null){
          const can=s.res.gold>=dr.nextCost;
          V.text('DrillCost',`下一级：铜钱 ${fmt.fmtNum(dr.nextCost)}`,-170,dy-10,430,17,dim);
          V.button('DrillGo',can?'操 练':'铜钱不足',225,dy,180,54,()=>{const r:any=store.drillHero(h.id);ctx.tell(r,r.ok?`${h.name} 操练至 ${r.level} 级（悬赏加成 +${Math.round(r.bonusPct*100)}%）`:'');},can?palette.gold:palette.paperDark);
        } else {
          V.text('DrillMax','已达操练上限 · 悬赏加成 +'+Math.round(dr.bonusPct*100)+'%',0,dy-14,600,19,tone('#d9b06a'));
        }
        next=dy-64;
      }
    }
    if(h.rarity===4&&(config.TRIALS as any).enabled){
      const trial=(store as any).trialInfo(h.id);
      V.button('TrialGo',trial.cleared?`试炼·已通关「${trial.name}」 · 复习`:`名将试炼 · ${trial.name}`,0,next-44,350,72,()=>{trialPreviewHero=h.id;ctx.show('heroDetail');},palette.gold);
      next-=96;
    }
    if(ctx.heroDetailOrigin==='heroes')V.button('ReturnHeroes','返回群英录',0,next-40,350,72,()=>ctx.back('heroes'),palette.paperDark);
  });
  // 名将试炼开战前弹层（C2，stagePreview 模式）：敌阵/机制/奖励
  if(trialPreviewHero){
    const t=(store as any).trialInfo(trialPreviewHero);
    if(t){
      U.rect('TrialShade',0,0,720,1280,new Color(12,10,8,190));
      U.tap('TrialShadeTap',0,0,720,1280,()=>{trialPreviewHero='';ctx.show('heroDetail');});
      U.panel('TrialPanel',0,60,658,782,tone('#251b14'),12,gold);
      U.tap('TrialBlock',0,60,658,782,()=>{});
      U.text('TrialTitle',`名将试炼 · ${t.name}`,0,406,560,30,gold);
      U.text('TrialHint',t.hint,0,372,580,17,tone('#ad9977'));
      U.text('TrialMechHead','敌方机制',-244,336,200,20,LIGHT);
      const mechNames:any={ccImmune:'免疫控制',cheatRevivePct:'倒地再起',armoryStartShield:'开场护盾',dmgReduce:'伤害减免',thorns:'反弹伤害',firstEnergy:'开场怒气',vamp:'攻击吸血'};
      Object.entries(t.extraPassive).forEach(([k,v]:any,i:number)=>{
        U.text('TrialMech'+i,`${mechNames[k]||k}（${typeof v==='number'&&v<1?Math.round(v*100)+'%':v}）`,0,306-i*34,560,18,tone('#e0856a'));
      });
      U.text('TrialEnemyHead','敌方阵容',-244,220,200,20,LIGHT);
      const e=stages.makeTrialEnemies(t.heroId,store.playerLevel());
      e.units.forEach((u:any,i:number)=>{
        const yy=180-i*46;
        U.panel('TrialEnemy'+i,0,yy,600,40,tone('#171009'),6,tone('#5a452a'));
        U.text('TrialEnemyName'+i,`${i===0?'主将 · ':''}${u.hero.name} Lv.${u.level}`,-190,yy,320,19,u.isBoss?gold:LIGHT);
        U.text('TrialEnemyCls'+i,((config.CLASSES as any)[u.hero.cls]&&((config.CLASSES as any)[u.hero.cls].name))||'武将',180,yy,120,17,tone('#a99778'));
      });
      U.text('TrialReward',t.cleared?'已通关 · 复习不发奖':`首通：荣耀 +${t.honor}（当前 ${t.clearedCount}/${t.total}，全通授「${t.allTitle}」）`,0,-188,600,19,t.cleared?tone('#a99778'):gold);
      U.button('TrialFight','出 战',-149,-240,270,60,()=>{
        trialPreviewHero='';
        (ctx as any).trialHeroId=t.heroId;
        ctx.startBattle('trial',0);
      },palette.gold);
      U.button('TrialClose','稍后再战',149,-240,270,60,()=>{trialPreviewHero='';ctx.show('heroDetail');},tone('#3a2b20'));
    } else trialPreviewHero='';
  }
  if(h.rarity<=2)firstTimeOverlay(ctx,'drill');
  U.panel('DetailActionBackground',0,-579,720,122,new Color(7,27,24,245),0,gold);
  U.panel('FormationAction',0,-568,538,82,new Color(25,87,65,255),11,gold);
  U.text('FormationActionText','调整编队',0,-568,506,34,gold);
  U.tap('FormationActionTap',0,-568,538,82,()=>ctx.go('formation'));
}
function heroInfoModal(ctx: ScreenContext,title:string,lines:string[]) {
  const U=ctx.ui,body=lines.map(line=>wrapHeroText(line,27)).join('\n');
  U.rect('HeroInfoShade',0,0,720,1280,new Color(5,12,11,214));
  U.tap('HeroInfoShadeTap',0,0,720,1280,()=>ctx.show(ctx.page));
  U.panel('HeroInfoPanel',0,6,638,540,new Color(17,36,31,255),14,gold);
  U.text('HeroInfoTitle',title,0,203,560,38,gold);U.textBlock('HeroInfoBody',body,0,13,555,331,25,paper);
  U.button('HeroInfoClose','关闭',0,-211,274,77,()=>ctx.show(ctx.page),palette.green);
}
function wrapHeroText(value:string,max:number) {
  const lines:string[]=[];for(const source of String(value||'').split('\n')){let rest=source;
    while(rest.length>max){lines.push(rest.slice(0,max));rest=rest.slice(max);}lines.push(rest);}
  return lines.join('\n');
}

export function summon(ctx: ScreenContext) {
    const s=store.getState(),U=ctx.ui;
    U.rect('SummonBackdrop',0,0,720,1280,ink);
    U.panel('GemBalance',-175,611,334,42,ink,21,border);
    U.text('GemBalanceText',`元宝 ${fmt.fmtNum(s.res.gem)}`,-175,611,304,20,gold);
    U.panel('ScrollBalance',175,611,334,42,ink,21,border);
    U.text('ScrollBalanceText',`招募令 ${s.res.scroll}`,175,611,304,20,gold);
    U.panel('SummonHall',0,442,686,288,panel,13,gold);
    U.text('SummonHallTitle','召唤 · 点将台',0,552,600,42,gold);
    U.text('SummonHallSubtitle','聚天下英杰 · 成千秋霸业',0,508,590,20,dim);
    U.scene('SummonSealArt',g=>{
      g.strokeColor=tone('#765a30');g.lineWidth=3;g.circle(0,436,74);g.stroke();
      for(let i=0;i<12;i++){
        const a=i*Math.PI/6;
        g.moveTo(Math.cos(a)*84,436+Math.sin(a)*84);
        g.lineTo(Math.cos(a)*111,436+Math.sin(a)*111);
      }
      g.stroke();
    });
    U.panel('SummonSeal',0,436,72,72,tone('#57402d'),10,gold);
    U.text('SummonSealText','将',0,436,68,42,gold);
    U.text('SummonRates','概率 SSR 2% · SR 10% · R 28% · N 60%',0,360,630,19,dim);
    U.text('SummonSoft','31 抽起 SSR 概率递增 · 40 抽必出 SSR',0,330,630,15,tone('#d9b06a'));
    const pity=store.summonPityInfo();
    U.panel('SummonPool',0,290,686,96,panel,9,border);
    U.text('PoolTitle',`武将池 · ${heroData.HEROES.length} 将 · SSR 保底 ${pity.sinceSsr}/${pity.ssrHard} 抽`,-73,318,590,19,dim);
    const rarity:[string,string,number][]=[['SSR','#e2b95f',4],['SR','#b37ac9',3],['R','#5f90c8',2],['N','#b9bec3',1]];
    rarity.forEach(([name,hex],i)=>{
      const x=-264+i*175;
      U.panel('RarityMark'+i,x-47,285,19,19,tone(hex),2);
      U.text('RarityName'+i,name,x+4,285,83,20,tone(hex));
    });
    U.text('PoolCounts',rarity.map(([name,,level])=>`${name} ${heroData.HEROES.filter((h:any)=>h.rarity===level).length}`).join(' · '),0,252,610,17,dim);
    const draws:[string,string,string,string,()=>void][]=[
      ['Single','招募 ×1','招募令 ×1','#392719',()=>ctx.confirm('确认招募','消耗招募令 ×1',()=>ctx.summonDraw('scroll1'))],
      ['TenScroll','招募 ×10','招募令 ×10','#d9ac5f',()=>ctx.confirm('确认招募','消耗招募令 ×10',()=>ctx.summonDraw('scroll10'))],
      ['SingleGem','元宝单抽',`元宝 ×${config.GACHA.singleGold}`,'#d9ac5f',()=>ctx.confirm('确认招募',`消耗元宝 ×${config.GACHA.singleGold}`,()=>ctx.summonDraw('gem1'))],
      ['TenGem','元宝十连',`元宝 ×${config.GACHA.costTenGold}`,'#d9ac5f',()=>ctx.confirm('确认招募',`消耗元宝 ×${config.GACHA.costTenGold}`,()=>ctx.summonDraw('gem10'))]
    ];
    draws.forEach(([id,title,cost,hex,action],i)=>{
      const x=-267+i*178,bg=tone(hex),dark=i===0;
      U.panel(id,x,185,166,88,bg,9,gold);
      U.text(id+'Title',title,x,204,150,26,dark?gold:ink);
      U.text(id+'Cost',cost,x,165,150,17,dark?dim:tone('#573d1e'));
      U.tap(id+'Tap',x,185,166,88,action);
    });
    // —— 招贤值 / 定向招募 / 万能 SSR 卡（下半屏）——
    const pts=store.summonPointsInfo();
    U.panel('PointsPanel',0,-28,686,150,panel,9,border);
    U.text('PointsTitle',`招贤值 · 累计 ${pts.total} 抽`,-190,15,320,24,gold);
    if(pts.canClaim){
      const ct=pts.list.find((x:any)=>x.claimable);
      U.button('PointsClaim','可领：'+(ct?ct.label:''),170,15,300,46,()=>{
        const r=store.claimSummonPoints(ct.tier);
        ctx.tell(r,r.ok?'已领取 '+r.label:'');
      },gold);
    } else {
      const next=pts.list.find((x:any)=>!x.claimed);
      U.text('PointsNext',next?`下一档 ${next.need} 抽：${next.label}`:'全部档位已领完',150,15,380,18,tone('#ad9977'));
    }
    pts.list.forEach((t:any,i:number)=>{
      const x=-264+i*132,y=-48;
      U.panel('PointTier'+i,x,y,124,66,t.claimed?tone('#26301f'):t.claimable?tone('#3a2c17'):ink,7,t.claimable?gold:border);
      U.text('PointNeed'+i,t.need+' 抽',x,y+10,116,17,t.claimable?gold:dim);
      U.text('PointLabel'+i,t.claimed?'已领':t.label,x,y-14,116,15,t.claimed?tone('#6f8a5f'):dim);
      if(t.claimable)U.tap('PointTap'+i,x,y,124,66,()=>{const r=store.claimSummonPoints(t.tier);ctx.tell(r,r.ok?'已领取 '+r.label:'');});
    });
    const tk=store.summonTicketInfo();
    U.panel('TicketPanel',0,-186,686,120,panel,9,border);
    U.text('TicketTitle','定向招募',-278,-150,160,22,gold);
    U.text('TicketInfo',`券 ${tk.stock} 张 · 本周已用 ${tk.used}/${tk.limit} · 每 10 抽赠 1 张`,130,-150,440,17,dim);
    U.text('TicketHint','券激活后下一组十连：SR 以上 70% 落所选阵营',130,-178,440,15,tone('#ad9977'));
    (config.FACTIONS ? Object.keys(config.FACTIONS) : []).forEach((fk:any,i:number)=>{
      const x=-258+i*150,f=(config.FACTIONS as any)[fk];
      const active=tk.activeFocus===fk;
      const can=tk.canArm||active;
      U.panel('FactionBtn'+i,x,-212,142,44,active?tone('#45321b'):ink,8,active?gold:border);
      U.text('FactionTxt'+i,(active?'● ':'')+f.name+(active?' 定向中':''),x,-212,134,20,active?gold:LIGHT);
      if(can)U.tap('FactionTap'+i,x,-212,142,44,()=>{
        const r=store.setSummonFocus(active?null:fk);
        ctx.tell(r,r.ok?(r.focus?'已定向：'+(config.FACTIONS as any)[r.focus].name+'（下一组十连生效）':'已取消定向'):'');
      });
    });
    if((s.res as any).univSsr>0){
      const univTargets=heroData.HEROES.filter((hh:any)=>hh.rarity===4&&s.roster[hh.id]&&s.roster[hh.id].star<4).length;
      U.panel('UnivPanel',0,-300,686,72,tone('#3a2c17'),9,gold);
      U.text('UnivTitle',univTargets?`万能 SSR 卡 ×${(s.res as any).univSsr} · 可指定一只未满星 SSR 升星`:`万能 SSR 卡 ×${(s.res as any).univSsr} · SSR 已全部满星，暂无目标`,-140,-246,460,20,univTargets?gold:dim);
      U.button('UnivUse',univTargets?'使 用':'无目标',240,-300,170,54,()=>{if(!univTargets)return;univPickOpen=true;ctx.show('summon');},univTargets?gold:tone('#423022'));
    }
    if(univPickOpen){
      const owned=heroData.HEROES.filter((hh:any)=>hh.rarity===4&&s.roster[hh.id]&&s.roster[hh.id].star<4)
        .sort((x:any,y:any)=>s.roster[x.id].star-s.roster[y.id].star);
      U.rect('UnivShade',0,0,720,1280,tone('#120c07')).on(Node.EventType.TOUCH_END,()=>{});
      U.panel('UnivPanel2',0,0,658,900,tone('#251b14'),12,gold);
      U.text('UnivHeading',`选择万能卡目标（${owned.length} 只未满星）`,0,390,560,28,gold);
      U.text('UnivHint','按当前星级从低到高排列',0,348,560,16,dim);
      owned.forEach((hh:any,i:number)=>{
        const y=290-i*84;
        U.panel('UnivRow'+i,0,y,600,74,panel,8,border);
        U.text('UnivName'+i,hh.name+'（★'+s.roster[hh.id].star+'）',-160,y,320,22,paper);
        U.button('UnivGo'+i,'升星',225,y,130,50,()=>{
          const r=store.useUniversalSsr(hh.id);
          univPickOpen=false;
          ctx.tell(r,r.ok?(r.isNew?'解锁 '+hh.name:hh.name+' 升至 ★'+r.star):'');
        },gold);
      });
      U.button('UnivCancel','取消',0,-400,280,54,()=>{univPickOpen=false;ctx.show('summon');},tone('#423022'));
    }
    U.panel('SummonAd',0,76,678,46,tone('#2b1e12'),8,border);
    U.text('SummonAdText','看广告 · 免费招募令 ×1',0,76,618,20,gold);
    U.tap('SummonAdTap',0,76,678,46,()=>ctx.playAd('summon',()=>{
      store.applyReward({scroll:1});return {ok:true};
    },'获得招募令 ×1'));
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
    U.text('DrawSubheading','新英雄直接入队 · 重复武将自动升星 · 满星后 N/R 转铜钱、SR 转碎片、SSR 转将魂',0,425,630,18,dim);
    ctx.lastSummon.forEach((result: any, i: number) => {
      const hero = heroData.getHero(result.id);
      if (!hero) return;
      // 十连 4 列×3 行（3 列会出第 4 行撞 DrawGap 信息栏，实拍 P2）
      const ten=ctx.lastSummon.length===10;
      const cols=ten?4:Math.min(3,ctx.lastSummon.length);
      const x=ten?-(cols-1)*86+(i%cols)*172:-(cols-1)*111+(i%cols)*222;
      const y=ctx.lastSummon.length===1?70:313-Math.floor(i/cols)*207;
      const rarity=rarityNames[hero.rarity]||'N';
      const openHero = () => {ctx.selectedHeroId=result.id;ctx.heroDetailOrigin='summonResults';ctx.go('heroDetail');};
      const single=ctx.lastSummon.length===1;
      const accent=tone(rarityColors[hero.rarity]);
      U.panel('DrawCard'+i,x,y,single?350:(ten?160:205),single?420:(ten?150:193),panel,9,accent);
      U.heroIcon('DrawAvatar'+i,x,single?y+54:(ten?y+30:y+38),single?214:(ten?100:135),single?220:(ten?74:98),{surname:hero.surname||hero.name[0],faction:hero.faction,rarity:hero.rarity,artKey:hero.id});
      U.text('DrawName'+i,hero.name,x,single?y-78:(ten?y-42:y-35),single?290:(ten?130:180),single?30:(ten?19:23),paper);
      U.text('DrawRarity'+i,rarity,x,single?y-120:(ten?y-64:y-63),single?210:(ten?120:154),20,accent);
      U.text('DrawStatus'+i,result.isNew?'NEW':result.autoStar?`★${result.fromStar}→${result.star}`
        :result.soulGain?`将魂+1·余${result.soul||0}`
        :result.shardGain?`碎片+1·${result.qualityShards||0}/10`
        :result.goldGain?`铜钱+${fmt.fmtNum(result.goldGain)}`
        :`留存 ×${result.cards||1}`,x,single?y-157:(ten?y-80:y-83),single?235:(ten?130:162),17,dim);
      U.tap('DrawCardTap'+i,x,y,single?350:(ten?160:205),single?420:(ten?150:193),openHero);
    });
    // SSR 登场引言（研讨会六 C2）：本抽出新 SSR 时展示专属登场卡（quote 复用，零新文案）
    {
      const debut=ctx.lastSummon.find((r2:any)=>{const hh=heroData.getHero(r2.id);return hh&&hh.rarity===4&&r2.isNew;});
      if(debut){
        const dh=heroData.getHero(debut.id);
        U.panel('DebutCard',0,60,620,110,tone('#2a1c10'),12,palette.gold);
        U.text('DebutTag','初 登 场',0,88,560,18,tone('#d9b06a'));
        U.text('DebutName',`${dh.name} · ${dh.title||'武将'}`,0,58,560,24,palette.gold);
        U.text('DebutQuote',`「${dh.quote||'——'}」`,0,26,560,18,tone('#c9b489'));
      }
    }
    // 抽卡差页引导（研讨会二 P2）：SSR 缺口 + 保底余量 + 品质碎片兑换推荐
    {
      const gap=store.summonGapInfo();
      U.panel('DrawGap',0,-300,660,140,tone('#312218'),9,tone('#795b34'));
      U.text('DrawGapTitle',`SSR 收集 ${gap.ownedFull}/${gap.total} · 硬保底还剩 ${gap.pityLeft} 抽`,0,-266,630,19,gold);
      const gapText=gap.gaps.length?gap.gaps.map((g:any)=>`${g.name}·${g.kind==='missing'?'未获得':'★'+g.star}`).join('  '):'SSR 已全部满星';
      U.text('DrawGapList',`缺口：${gapText}`,0,-296,630,17,paper);
      U.text('DrawGapEx',gap.exchange?`品质碎片 ${gap.shard}/${gap.need} · 可兑换「${gap.exchange.name}」`:gap.gaps.length?`品质碎片 ${gap.shard}/${gap.need} · 集满可兑换缺口 SSR`:`品质碎片 ${gap.shard}/${gap.need}`,0,-324,630,17,tone('#d9b06a'));
    }
    U.panel('DrawContinue',-169,-478,298,62,tone('#d9a94e'),9,gold);
    U.text('DrawContinueText','继续招募',-169,-478,275,23,ink);
    U.tap('DrawContinueTap',-169,-478,298,62,()=>ctx.go('summon'));
    U.panel('DrawRoster',169,-478,298,62,tone('#3d6653'),9,gold);
    U.text('DrawRosterText','查看群英',169,-478,275,23,paper);
    U.tap('DrawRosterTap',169,-478,298,62,()=>ctx.go('heroes'));
  }

const FORGE_TIERS = ['白', '蓝', '紫'];

export function forgeView(ctx: ScreenContext) {
  const U=ctx.ui,s=store.getState();
  const slot=ctx.selectedArmorySlot||'weapon';
  const info=store.forgeInfo(slot);
  ctx.title('锻 造 台');
  U.text('ForgeBack','‹ 返回',-291,484,130,22,gold);
  U.tap('ForgeBackTap',-291,484,136,52,()=>ctx.go('armory'));
  if(!info.open){
    const stars=items.ARMORY_SLOTS.filter((sl:any)=>s.armory.slotStars[sl.id]>=5).length;
    U.text('ForgeClosed',`锻造台尚未开启 · 六槽全部 5★ 后开启（${stars}/6）`,0,250,640,22,dim);
    return;
    firstTimeOverlay(ctx,'forge');
  }
  items.ARMORY_SLOTS.forEach((sl:any,i:number)=>{
    const x=-252+i*101,active=sl.id===slot;
    U.panel('ForgeSlot'+i,x,398,95,54,active?tone('#45321b'):ink,7,active?gold:border);
    U.text('ForgeSlotName'+i,sl.name,x,398,88,20,active?gold:LIGHT);
    U.tap('ForgeSlotTap'+i,x,398,95,54,()=>{ctx.selectedArmorySlot=sl.id;ctx.show('forge');});
  });
  U.text('ForgeFree',`免费洗练剩余 ${info.freeRerolls} 次`,200,443,260,17,dim);
  // 方向
  U.text('ForgeDirTitle','第一词条方向（另一词条自动取对方池）',0,340,640,18,dim);
  [['atk','攻 系','poolAtk'],['def','守 系','poolDef']].forEach(([dir,label],i)=>{
    const x=i===0?-160:160,active=info.dir===dir;
    U.panel('ForgeDir'+i,x,282,300,64,active?tone('#45321b'):ink,9,active?gold:border);
    U.text('ForgeDirTxt'+i,String(label)+(active?' · 已选':''),x,282,290,24,active?gold:LIGHT);
    U.tap('ForgeDirTap'+i,x,282,300,64,()=>{const r=store.forgeSetDir(slot,dir as string);ctx.tell(r,r.ok&&r.changed?'已选方向（原词条作废重洗）':'');});
  });
  // 两词条位
  if(info.dir){
    [0,1].forEach(idx=>{
      const y=idx===0?128:8;
      const a=info.slots[idx],lock=info.lock[idx],pity=info.pity[idx];
      U.panel('ForgeAffix'+idx,0,y,682,110,a?tone('#312218'):ink,9,a&&a.tier===2?gold:border);
      if(!a){
        U.text('ForgeAffixName'+idx,`词条位 ${idx+1} · 未洗练`,-180,y+18,340,22,dim);
        U.button('ForgeRoll'+idx,'洗 练',230,y,180,58,()=>{const r=store.forgeReroll(slot,idx);ctx.tell(r,r.ok?`洗出 ${r.affix.name} ${Math.round(r.affix.val*1000)/10}%（${FORGE_TIERS[r.affix.tier]}）`:'');},gold);
      } else {
        U.text('ForgeAffixName'+idx,`${a.name} ${Math.round(a.val*1000)/10}%（${FORGE_TIERS[a.tier]}）`,-180,y+22,400,24,a.tier===2?gold:LIGHT);
        U.text('ForgePity'+idx,`保底 ${pity}/6`,-180,y-18,300,16,dim);
        U.button('ForgeLock'+idx,lock?'已锁定':'未锁定',60,y,130,50,()=>{const r=store.forgeToggleLock(slot,idx);ctx.tell(r,r.ok?(r.lock?'已锁定':'已解锁'):'');},lock?gold:tone('#423022'));
        U.button('ForgeRoll'+idx,'重 洗',235,y,180,58,()=>{const r=store.forgeReroll(slot,idx);ctx.tell(r,r.ok?`洗出 ${r.affix.name} ${Math.round(r.affix.val*1000)/10}%（${FORGE_TIERS[r.affix.tier]}）`:'');},gold);
      }
    });
    U.text('ForgeCost','重洗消耗 铜钱 12000 + 精铁 25（另一条锁定时 ×2）',0,-70,640,16,dim);
    // 熔炉
    const sm=store.smeltInfo();
    U.panel('SmeltPanel',0,-160,682,150,panel,9,border);
    U.text('SmeltTitle','熔炉 · 重复军械再利用',-240,-134,400,20,gold);
    ['1','2'].forEach((qq,ri)=>{
      const q=Number(qq),x=ri===0?-160:160;
      const rn=q===1?'3 件同槽 N + 铁60 + 钱8000 → 随机 R':'3 件同槽 R + 铁150 + 钱20000 → 随机 SR';
      U.button('SmeltCombine'+ri,rn,x,-92,310,44,()=>{const r=store.smeltCombine(q===1?'weapon':'armor',q);ctx.tell(r,r.ok?(r.name?'合成 '+r.name:'折精铁 +'+r.convertedIron):'');},gold);
    });
    if(!sm.stock.length){
      U.text('SmeltEmpty','库存空 · 25 关后重复获得的军械存入此处（可熔回 70% 精铁）',0,-160,640,15,dim);
    } else {
      sm.stock.slice(0,3).forEach((it:any,i:number)=>{
        const y=-196-i*44,x=0;
        U.panel('SmeltItem'+i,x,y,640,40,ink,6,border);
        U.text('SmeltItemName'+i,`${it.name} ×${it.count}`,-150,y,320,17,LIGHT);
        U.button('SmeltMelt'+i,`熔回精铁 ${it.meltIron}`,230,y,150,36,()=>{const r=store.smeltMelt(it.id);ctx.tell(r,r.ok?`已熔炼 ${it.name}，精铁 +${r.iron}`:'');},gold);
      });
    }
  } else {
    U.text('ForgeNoDir','先选择攻/守方向，开启词条位',0,80,640,20,dim);
  }
}

export function codexView(ctx: ScreenContext) {
  const U=ctx.ui,s=store.getState(),info=store.codexInfo();
  ctx.title('图 鉴 收 集');
  U.text('CodexBack','‹ 返回',-291,484,130,22,gold);
  U.tap('CodexBackTap',-291,484,136,52,()=>ctx.go('bag'));
  // 收集率摘要（研讨会九 B）：各稀有度收集进度实时派生
  {
    const H2=heroData;
    const owned=Object.keys(s.roster||{});
    const rate=(r:number)=>{const all=H2.HEROES.filter((h:any)=>h.rarity===r);return all.filter((h:any)=>owned.indexOf(h.id)>=0).length+'/'+all.length;};
    U.text('CodexGuide',`收集 ${owned.length}/120 · N ${rate(1)} · R ${rate(2)} · SR ${rate(3)} · SSR ${rate(4)}`,0,443,640,18,gold);
  }
  info.list.forEach((r:any,i:number)=>{
    const y=375-i*88;
    U.panel('CodexRow'+i,0,y,640,78,r.claimed?tone('#26301f'):r.claimable?tone('#3a2c17'):ink,8,r.claimable?gold:border);
    U.text('CodexName'+i,r.name,-180,y+16,270,21,r.claimable?gold:LIGHT);
    if(r.key==='all-ssr')U.text('CodexSsrSrc'+i,'来源：招募/券/碎片/招贤值',55,y+12,180,12,tone('#8a7c5f'));
    let lackText=`${r.have}/${r.need}`;
    if(!r.done){const H3=heroData;
      // 从 key 反推缺谁：阵营行（f-nr/f-sr）与 all-sr/all-ssr
      const owned=new Set(Object.keys(s.roster||{}));
      let ids:any[]=[];
      if(r.key==='all-sr')ids=H3.HEROES.filter((h:any)=>h.rarity===3);
      else if(r.key==='all-ssr')ids=H3.HEROES.filter((h:any)=>h.rarity===4);
      else if(r.key&&r.key.endsWith('-nr'))ids=H3.HEROES.filter((h:any)=>h.faction===r.key.split('-')[0]&&h.rarity<=2);
      else if(r.key&&r.key.endsWith('-sr'))ids=H3.HEROES.filter((h:any)=>h.faction===r.key.split('-')[0]&&h.rarity===3);
      const missing=ids.filter((h:any)=>!owned.has(h.id)).map((h:any)=>h.name);
      if(missing.length<=4)lackText=`${r.have}/${r.need} · 缺 ${missing.join('、')}`;
      else lackText=`${r.have}/${r.need} · 缺 ${missing.slice(0,4).join('、')} 等`;
    }
    U.text('CodexProg'+i,lackText,-85,y-16,450,16,dim);
    U.button('CodexClaim'+i,r.claimed?'已领取':r.claimable?'领 取':'未集齐',230,y,150,50,()=>{
      const res=store.claimCodex(r.key);
      ctx.tell(res,res.ok?'已领取 '+r.name:'');
    },r.claimable?gold:tone('#423022'));
  });
}

// 神兵阁（研讨会十三案二）：传世宝物认主/淬炼/上阵（全军 1 件）
export function relicsView(ctx: ScreenContext) {
  const U=ctx.ui,info=(store as any).relicInfo();
  ctx.title('神 兵 阁');
  U.text('RelicBack','‹ 返回',-291,484,130,22,gold);
  U.tap('RelicBackTap',-291,484,136,52,()=>ctx.back('bag'));
  if(!info.enabled){U.text('RelicClosed','神兵阁暂未开放',0,200,600,20,LIGHT);return;}
  if(!info.unlocked){
    U.panel('RelicLockPanel',0,200,620,180,tone('#251b14'),12,gold);
    U.text('RelicLockTitle','神兵阁 封印中',0,246,560,30,gold);
    U.text('RelicLockDesc','通关主线第 160 关后开启',0,206,560,20,LIGHT);
    U.text('RelicLockProg',`当前进度：第 ${store.getState().campaign.cleared||0} 关`,0,168,560,18,tone('#ad9977'));
    return;
  }
  U.panel('RelicHeader',0,424,682,72,tone('#3a2c17'),10,gold);
  U.text('RelicStones',`淬火石 ${info.stones}`,150,444,200,24,gold);
  U.text('RelicSource',`来源：远征每周达 20 层 +20`,150,414,300,15,tone('#ad9977'));
  U.text('RelicSetTitle',info.setOwned?'传世套装已激活 · 全军三维 +3%':`传世套装：集齐 8 件（${info.ownedCount}/${info.total}）`, -160,444,340,20,info.setOwned?gold:LIGHT);
  U.text('RelicSetSub',info.setOwned?'':'认主条件：通过对应名将试炼',-160,414,340,15,tone('#ad9977'));
  const mechNames:any={ccImmune:'免疫控制',cheatRevivePct:'倒地再起',armoryStartShield:'开场护盾',dmgReduce:'伤害减免',thorns:'反弹伤害',firstEnergy:'开场怒气',vamp:'攻击吸血',critDmg:'暴击伤害',energyGain:'怒气获取',recvHeal:'受疗提升'};
  info.list.forEach((r:any,i:number)=>{
    const y=330-i*112;
    U.panel('RelicCard'+i,0,y,640,100,r.owned?(r.equipped?tone('#3a2c17'):tone('#312218')):tone('#171009'),9,r.equipped?gold:tone('#795b34'));
    U.text('RelicName'+i,r.name,-200,y+26,240,24,r.owned?gold:LIGHT);
    U.seal('RelicSeal'+i,-288,y+26,40,r.name[0],r.owned?gold:palette.ink,tone('#795b34'),r.owned?palette.ink:tone('#7a6c52'),20);
    const valTxt=r.owned?`${mechNames[r.key]||r.key} ${(r.fmt==='pct'?'+':'+')}${r.fmt==='pct'?Math.round(r.val*100)+'%':r.val}`:'认主条件：通过对应名将试炼';
    U.text('RelicVal'+i,valTxt+(r.owned&&r.level<r.maxLevel?`（${r.level}/5 级）`:r.owned?'（满级）':''),-170,y-8,440,17,r.owned?tone('#d9b06a'):tone('#7a6c52'));
    if(r.equipped)U.text('RelicEq'+i,'上阵中',240,y+26,140,18,gold);
    if(!r.owned){
      U.button('RelicAct'+i,r.locked?'试炼未通':'认 主',240,y-10,150,48,()=>{
        const res=(store as any).claimRelic(r.id);
        ctx.tell(res,res.ok?`「${res.name}」已认主`:'');
        if(res.ok)ctx.show('relics');
      },r.locked?tone('#423022'):palette.gold);
    }else{
      U.button('RelicEq'+i+'_Go',r.equipped?'卸 下':'上 阵',240,y+22,150,40,()=>{
        const res=(store as any).equipRelic(r.id);
        ctx.tell(res,res.ok?(res.name?`「${res.name}」上阵`:'已卸下'):'');
        if(res.ok)ctx.show('relics');
      },r.equipped?tone('#423022'):palette.gold);
      if(r.level<r.maxLevel){
        const can=r.canUpgrade;
        U.button('RelicUp'+i,`淬 炼 ${r.level}→${r.level+1}`,240,y-26,150,40,()=>{
          const res=(store as any).upgradeRelic(r.id);
          ctx.tell(res,res.ok?`「${res.name}」淬炼至 ${res.level} 级`:'');
          if(res.ok)ctx.show('relics');
        },can?palette.gold:tone('#423022'));
        U.text('RelicCost'+i,`淬火石${r.nextStone}+铜钱${fmt.fmtNum(r.nextGold)}`,60,y-38,300,13,can?tone('#d9b06a'):tone('#bb614c'));
      }
    }
  });
  firstTimeOverlay(ctx,'relics');
}

export function achvView(ctx: ScreenContext) {
  const U=ctx.ui,info=store.achvInfo();
  ctx.title('主 公 成 就');
  U.text('AchvBack','‹ 返回',-291,484,130,22,gold);
  U.tap('AchvBackTap',-291,484,136,52,()=>ctx.back('bag'));
  // 完整档位列表（滚动）
  let flat:any[]=[];
  info.axes.forEach(ax=>ax.tiers.forEach(t=>flat.push({axis:ax.key,name:ax.name,tier:t.tier,need:t.need,reward:t.reward,claimed:t.claimed,claimable:t.claimable,value:ax.value})));
  flat=flat.filter(t=>t.claimable||!t.claimed);
  flat.sort((a:any,b:any)=>{
    if(a.claimable!==b.claimable)return b.claimable?1:-1;
    return (b.value/b.need)-(a.value/a.need);
  });
  U.scroll('AchvList',0,-60,680,830,Math.max(830,flat.length*72+20),V=>{
    flat.forEach((t,i)=>{
      const y=Math.max(830,flat.length*72+20)/2-36-i*72;
      V.panel('AchvRow'+i,0,y,656,68,t.claimable?tone('#3a2c17'):ink,7,t.claimable?gold:border);
      V.text('AchvRowName'+i,`${t.name} · 第${t.tier+1}档（需 ${t.need}）`,-170,y+2,400,19,t.claimable?gold:LIGHT);
      V.text('AchvRowReward'+i,Object.entries(t.reward).map(([k,n]:any)=>`${k==='title'?'称号':k==='frame'?'头像框':k==='gem'?'元宝':k==='shard'?'碎片':k==='token'?'演武令':k==='gold'?'铜钱':k==='scroll'?'招募令':k==='seals'?'印信':k}`+'×'+n).join(' · '),-170,y-24,420,15,dim);
      if(t.claimable)V.button('AchvGo'+i,'领 取',235,y,140,48,()=>{const r=store.claimAchv(t.axis,t.tier);ctx.tell(r,r.ok?'已领取 '+r.name:'');},gold);
    });
  });
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
    U.text('ArmoryIntro','',0,279,620,20,dim);
    if(recs.length){
      U.panel('ArmoryRecommend',0,220,610,49,tone('#d9a94e'),7,gold);
      U.text('ArmoryRecommendText',`免费启用推荐 · ${recs.length} 个部位`,0,220,586,20,ink);
      U.tap('ArmoryRecommendTap',0,220,610,49,()=>{
        ctx.confirm('免费启用军械建议',recs.map(r=>`${r.slotName}：${r.fromName} → ${r.toName}`).join('；'),()=>ctx.tell(store.applyArmoryRecommendations(recs),`已为全军启用 ${recs.length} 件`));
      });
    }
    const top=recs.length?120:160,cardH=232,pitch=246;
    const viewTop=top+cardH/2,viewBottom=-499,viewH=viewTop-viewBottom;
    const contentH=Math.max(viewH,3*pitch+190);
    U.scroll('ArmoryOverviewScroll',0,(viewTop+viewBottom)/2,700,viewH,contentH,V=>{
      items.ARMORY_SLOTS.forEach((slot:any,i:number)=>{
        const selected:any=items.CATALOG.find((item:any)=>item.id===s.armory.selected[slot.id]);
        const x=i%2?170:-170,y=contentH/2-cardH/2-Math.floor(i/2)*pitch;
        V.panel('ArmorySlotCard'+i,x,y,324,cardH,panel,9,gold);
        V.text('ArmorySlotName'+i,slot.name,x-71,y+85,155,25,gold);
        V.text('ArmorySlotStar'+i,`★${s.armory.slotStars[slot.id]||0}`,x+115,y+85,62,21,gold);
        {
          // 词条追求信息层（裁决 D）：只展示档位汇总，不改数值
          const badge=(store.armoryAffixBadges() as any)[slot.id];
          if(badge)V.text('ArmorySlotFx'+i,badge.label,x+42,y+86,66,15,
            badge.purple>=2?gold:badge.purple>=1?tone('#b57ce8'):dim);
        }
        V.text('ArmorySlotItem'+i,selected?.name||'尚未选择军械',x,y+40,295,22,selected?tone(items.GRADES[selected.q].color):dim);
        if(selected){
          V.text('ArmorySlotStats'+i,`${items.GRADES[selected.q].name} · ${armoryStats(selected.basePct||selected.stats)}`,x,y+10,296,17,dim);
          if(selected.effect)V.text('ArmorySlotEffect'+i,armoryEffect(selected.effect),x,y-16,296,16,dim);
        }
        V.text('ArmorySlotNode'+i,nodeLineText(slot.id,s.armory.slotStars[slot.id]||0),x,y-44,296,16,tone('#e2c088'));
        V.panel('ArmorySlotOpen'+i,x,y-88,295,43,tone('#39291a'),5,border);
        V.text('ArmorySlotOpenText'+i,'查看图鉴',x,y-88,270,18,gold);
        V.tap('ArmorySlotTap'+i,x,y,324,cardH,()=>{ctx.selectedArmorySlot=slot.id;CocosUi.resetScroll('CatalogScroll');ctx.go('armoryCatalog');});
      });
      const bonus:any=store.getArmoryBonuses(),summaryY=contentH/2-3*pitch-42;
      V.panel('ArmoryTotal',0,summaryY,680,103,panel,9,border);
      V.text('ArmoryTotalTitle','全军属性与战术效果',-171,summaryY+26,316,22,gold);
      V.text('ArmoryTotalStats',armoryStats(bonus),0,summaryY-19,643,18,dim);
      V.text('ArmoryHelp','重复获得的军械会转为精铁；部位升星后，全体英雄共同受益。',0,summaryY-77,660,18,dim);
      const mi=store.motifInfo();
      mi.list.forEach((m:any,i:number)=>{
        const x=i===0?-224:i===1?0:224;
        V.panel('MotifCard'+i,x,summaryY-238,218,150,m.active?tone('#45321b'):panel,8,m.active?gold:border);
        V.text('MotifName'+i,m.name,x,summaryY-208,210,22,m.active?gold:LIGHT);
        V.text('MotifDesc'+i,m.desc,x,summaryY-238,206,14,dim);
        V.text('MotifState'+i,m.active?'● 激活中':m.unlocked?'已解锁 · 点击启用':`件数 ${m.pieces}/4`,x,summaryY-268,206,15,m.active?gold:dim);
        if(!m.active)V.tap('MotifTap'+i,x,summaryY-238,218,150,()=>{
          const r=store.motifActivate(m.id,true);
          ctx.tell(r,r.ok?(r.switched?`已启用 ${r.name}`:`已激活 ${r.name}（精铁 ${r.iron}·铜钱 ${r.gold}）`):'');
        });
      });
            if((store.getArmoryState() as any).forgeOpen){
        V.button('ForgeEntry','锻造台已开启 · 词条洗练 ›',0,summaryY-134,660,52,()=>ctx.go('forge'),gold);
      } else {
        const fstars=items.ARMORY_SLOTS.filter((sl:any)=>s.armory.slotStars[sl.id]>=5).length;
        V.text('ForgeEntryText',`锻造台 · 六槽全部 5★ 后开启（${fstars}/6）`,0,summaryY-134,660,18,dim);
      }
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
    // 动态内容高（试玩 P2 修补）：随部位词条数与是否有待选箱变化，不再硬编码 1610
    const hasBoxes=[1,2,3].some((q:any)=>(s.armory.boxes[q]||0)>0);
    const viewH=840;
    const contentH=Math.max(viewH,674+slotItems.length*78+(hasBoxes?445:284)+24);
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
      const detailY=boxes.some(Boolean)?afterList-445:afterList-284;
      if(item){
        const bonusNow=store.getArmoryBonuses();
        const nodeNow=items.slotNodeInfo(slot.id,star);
        const nodeCost=items.slotNodeCost(slot.id,star);
        const lacks=nodeCost?[]:['已满星'];
        if(nodeCost){
          if(s.res.iron<nodeCost.iron)lacks.push(`精铁还差 ${nodeCost.iron-s.res.iron}`);
          if(s.res.gold<nodeCost.gold)lacks.push(`铜钱还差 ${fmt.fmtNum(nodeCost.gold-s.res.gold)}`);
        }
        V.panel('CatalogDetail',0,detailY,680,430,panel,10,gold);
        V.text('CatalogDetailName',item.name,-199,detailY+185,275,27,tone(items.GRADES[item.q].color));
        V.text('CatalogDetailType',`${slot?.name} · ${items.GRADES[item.q].name} · 部位 ★${star}`,-173,detailY+145,345,19,dim);
        V.text('CatalogDetailStats',`启用军械基础加成：${armoryStats(item.basePct||item.stats)}`,0,detailY+105,636,19,gold);
        V.text('CatalogDetailEffect',`名器固定效果：${item.effect?armoryEffect(item.effect)+'（0★ 即生效，不随星级放大）':'无'}`,0,detailY+68,636,17,paper);
        V.text('CatalogDetailNode',`部位升星节点（与启用军械无关）：${nodeLineText(slot.id,star)}`,0,detailY+28,636,17,tone('#e2c088'));
        V.text('CatalogDetailBonus',`全军加成：${armoryStats(bonusNow)}`,0,detailY-12,636,17,gold);
        V.text('CatalogDetailSource',item.q===0?'获得：新手赠送与战役奖励':`获得：战役奖励；通关第 ${items.GRADES[item.q].unlockStage} 关后可用精铁定向解锁`,0,detailY-50,636,17,dim);
        const owned=!!s.armory.unlocked[item.id],active=s.armory.selected[item.slot]===item.id;
        const ready=s.campaign.cleared>=items.GRADES[item.q].unlockStage;
        V.button('CatalogDetailAction',active?'全军正在使用':owned?'全军启用':ready?`精铁 ×${items.GRADES[item.q].cost} 解锁`:`通关第 ${items.GRADES[item.q].unlockStage} 关后开放`,0,detailY-186,629,52,()=>{
          if(active)return;
          if(owned)return ctx.tell(store.armorySelect(item.slot,item.id),`已为全军启用 ${item.name}`);
          if(!ready)return ctx.tell({ok:false,msg:'尚未满足关卡条件'},'');
          ctx.confirm('解锁军械确认',`${item.name} · 消耗精铁 ×${items.GRADES[item.q].cost}`,()=>ctx.tell(store.armoryUnlock(item.id),`已解锁 ${item.name}`));
        },active?palette.paperDark:palette.gold);
        V.button('CatalogStarOne','升一星',-165,detailY-124,200,52,()=>{
          if(star>=items.STAR_NEEDS.length)return ctx.tell({ok:false,msg:'部位已满星'},'');
          ctx.confirm('部位升星确认',`当前 ★${star} → ★${star+1}；消耗精铁 ${items.STAR_NEEDS[star]}、铜钱 ${fmt.fmtNum(items.STAR_GOLD[star])}`,()=>ctx.tell(store.armoryUpgrade(ctx.selectedArmorySlot),'部位升星成功'));
        },palette.paperDark);
        V.button('CatalogStarNode',nodeCost?`升至 ★${nodeCost.to}`:'节点已增强',150,detailY-124,290,52,()=>{
          if(!nodeCost)return ctx.tell({ok:false,msg:'该部位已满星 · 节点已增强'},'');
          if(lacks.length)return ctx.tell({ok:false,msg:'材料不足：'+lacks.join('、')},'');
          const nodeTo=items.slotNodeInfo(slot.id,nodeCost.to);
          ctx.confirm('升至 ★'+nodeCost.to,`部位 ★${nodeCost.from} → ★${nodeCost.to}；消耗精铁 ${nodeCost.iron}、铜钱 ${fmt.fmtNum(nodeCost.gold)}\n${nodeNow.tier===0?'解锁':'增强'}${nodeNow.label} ${nodeValText(nodeNow.stat,nodeTo!.current)}`,()=>{
            const r=store.armoryUpgradeToNode(ctx.selectedArmorySlot);
            ctx.tell(r,r.ok?`★${r.fromStar}→★${r.toStar} · ${r.node.unlocked?'解锁':r.node.enhanced?'增强为':'强化'}${r.node.label} ${nodeValText(nodeNow.stat,r.node.to)}`:'');
          });
        },lacks.length||!nodeCost?palette.paperDark:palette.gold);
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
