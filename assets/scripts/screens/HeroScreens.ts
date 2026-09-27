import { palette, hexColor as tone } from '../ui/CocosUi';
import { Node } from 'cc';
import { ScreenContext } from './ScreenContext';
import * as store from '../domain/store';
import * as heroData from '../domain/heroes';
import * as items from '../domain/items';
import * as config from '../domain/config';
import * as fmt from '../domain/fmt';

export function heroes(ctx: ScreenContext) {
    const U=ctx.ui,list = store.allRoster().sort((a: any,b: any)=>b.power-a.power);
    const gold=tone('#e4bd73'),paper=tone('#f0dfbd'),dim=tone('#ac9776');
    U.rect('HeroBackdrop',0,0,720,1280,tone('#20160e'));
    U.text('HeroesTitle','英雄 · 群英录',-162,564,365,46,gold);
    U.text('HeroesIntro','点击英雄，查看技能、等级与装备',-167,520,380,20,dim);
    U.panel('HeroesFormation',245,550,208,67,tone('#d9ad61'),13,gold);
    U.text('HeroesFormationText','调整编队',245,550,187,25,tone('#312015'));
    U.tap('HeroesFormationTap',245,550,208,67,()=>ctx.go('formation'));
    U.panel('HeroOwnedPanel',0,453,678,80,tone('#342518'),12,tone('#765733'));
    U.text('HeroOwned',`已拥有 ${list.length} 名武将`,-145,466,350,27,gold);
    U.text('HeroSharedLevel',`共享玩家等级 Lv.${store.playerLevel()} · 新将可立即上阵`,-70,432,500,18,dim);
    U.text('HeroSort','排序  战力 ↓',-230,379,250,22,gold);
    U.text('HeroPage',`第 ${ctx.pageIndex+1}/${Math.max(1,Math.ceil(list.length/6))} 页`,242,379,172,18,dim);
    list.slice(ctx.pageIndex*6,ctx.pageIndex*6+6).forEach((h: any,i: number)=>{
      const x=-231+(i%3)*231,y=181-Math.floor(i/3)*340;
      const data=heroData.getHero(h.id),rarity=data?.rarity||1;
      const accent=rarity>=4?tone('#e2b15e'):rarity>=3?tone('#ad79b8'):rarity>=2?tone('#6d9bc8'):tone('#afb5aa');
      U.panel('HeroCard'+i,x,y,215,315,tone('#302219'),12,accent);
      U.panel('HeroAvatar'+i,x,y+43,154,171,tone('#37463a'),15,accent);
      U.text('HeroAvatarText'+i,data?.surname||h.name[0],x,y+43,120,91,paper);
      U.text('HeroCardName'+i,h.name,x-28,y-77,144,28,paper);
      U.text('HeroCardRarity'+i,['','N','R','SR','SSR'][rarity],x+73,y-77,67,21,accent);
      U.text('HeroCardStars'+i,'★'.repeat(Math.min(5,h.star||0))+'☆'.repeat(Math.max(0,5-(h.star||0))),x,y-109,188,19,gold);
      U.text('HeroCardPower'+i,`Lv.${store.playerLevel()}   战力 ${fmt.fmtNum(h.power)}`,x,y-137,194,18,dim);
      U.tap('HeroCardTap'+i,x,y,215,315,()=>{ctx.selectedHeroId=h.id;ctx.go('heroDetail');});
    });
    U.panel('HeroPrev',-224,-484,195,56,tone('#3a2a1a'),8,gold);
    U.text('HeroPrevText','上一页',-224,-484,181,21,gold);
    U.tap('HeroPrevTap',-224,-484,195,56,()=>{ctx.pageIndex=Math.max(0,ctx.pageIndex-1);ctx.show('heroes');});
    U.panel('HeroSummon',0,-484,204,56,tone('#d9ad61'),8,gold);
    U.text('HeroSummonText','招募武将',0,-484,188,23,tone('#312015'));
    U.tap('HeroSummonTap',0,-484,204,56,()=>ctx.go('summon'));
    U.panel('HeroNext',224,-484,195,56,tone('#3a2a1a'),8,gold);
    U.text('HeroNextText','下一页',224,-484,181,21,gold);
    U.tap('HeroNextTap',224,-484,195,56,()=>{ctx.pageIndex=Math.min(Math.max(0,Math.ceil(list.length/6)-1),ctx.pageIndex+1);ctx.show('heroes');});
  }

export function heroDetail(ctx: ScreenContext) {
    const h: any=store.calcHero(ctx.selectedHeroId), owned=store.getOwned(ctx.selectedHeroId), choice=store.firstWinChoice(),U=ctx.ui;
    const gold=tone('#e4bd73'),paper=tone('#f0dfbd'),dim=tone('#aa987a'),dark=tone('#20160e');
    const rarity=['','N','R','SR','SSR'][h.rarity]||'N';
    U.rect('DetailBackdrop',0,0,720,1280,dark);
    U.text('DetailHeading','武 将',0,575,370,39,gold);
    U.text('DetailBack','‹ 返回',-290,575,120,25,gold);
    U.tap('DetailBackTap',-290,575,125,60,()=>ctx.go('heroes'));
    U.panel('DetailHeroPanel',0,346,676,248,tone('#322319'),14,tone('#8c6a3a'));
    U.panel('DetailPortrait',-244,346,152,182,tone('#37463a'),17,gold);
    U.text('HeroSurname',h.surname,-244,346,128,105,paper);
    U.text('DetailName',`${h.name}  ${rarity}`,32,424,356,33,gold);
    U.text('DetailIdentity',`${h.title} · ${h.faction} · 武将`,30,381,350,20,dim);
    U.text('DetailStars','★'.repeat(Math.min(5,h.star||0))+'☆'.repeat(Math.max(0,5-(h.star||0))),30,344,350,22,gold);
    U.text('DetailLevel',`全体共享 Lv.${h.level} · 战力 ${fmt.fmtNum(h.power)}`,57,302,403,20,gold);
    U.text('StatsHeading','属 性',-283,187,145,30,gold);
    U.panel('StatsPanel',0,100,676,144,tone('#322319'),12,tone('#795b34'));
    U.text('HeroHP',`生命  ${fmt.fmtNum(h.stats.hp)}`,-208,129,190,22,paper);
    U.text('HeroAttack',`攻击  ${fmt.fmtNum(h.stats.atk)}`,0,129,190,22,paper);
    U.text('HeroDefense',`防御  ${fmt.fmtNum(h.stats.def)}`,208,129,190,22,paper);
    U.text('HeroGrowth',`同名卡 ${owned.cards} 张 · 自动升星 · 共享等级`,0,68,610,18,dim);
    U.text('SkillsHeading','技 能',-283,-9,145,30,gold);
    U.panel('UltPanel',0,-102,676,130,tone('#322319'),12,tone('#795b34'));
    U.text('Ult',`必杀  ${h.ult.name}`,0,-62,617,26,gold);
    U.text('UltDesc',h.ult.desc,0,-113,617,19,dim);
    U.panel('PassivePanel',0,-249,676,120,tone('#322319'),12,tone('#795b34'));
    U.text('Passive',`被动  ${h.passiveDef.name}：${h.passiveDef.desc}`,0,-249,615,19,paper);
    U.button('LockCards',owned.lockedCards?'取消保护同名卡':'保护同名卡',-158,-379,286,70,()=>{
      const r=store.setCardsLocked(h.id,!owned.lockedCards);store.save();ctx.tell(r,r.locked?'同名卡已保护':'已取消保护');
    },palette.green);
    U.button('HeroArmory','共享军械',160,-379,286,70,()=>ctx.go('armory'),palette.paperDark);
    if(choice.available&&['liubei','guanyu','zhangfei'].includes(h.id))
      U.button('FirstWin','领取首胜自选武将',0,-473,440,65,()=>ctx.tell(store.claimFirstWinChoice(h.id),`已领取 ${h.name}`),palette.gold);
    else if((store.getState().vouchers[h.rarity===4?'ssr':'sr']||0)>0&&h.rarity>=3)
      U.button('UseVoucher','使用英雄自选券',0,-473,440,65,()=>ctx.confirm('使用自选券',`选择 ${h.name}，获得该武将一张`,()=>ctx.tell(store.useChoiceVoucher(h.rarity,h.id),`获得 ${h.name}`)),palette.gold);
    else U.button('HeroBack','返回群英',0,-473,340,65,()=>ctx.go('heroes'),palette.paperDark);
  }

export function summon(ctx: ScreenContext) {
    const s=store.getState(),U=ctx.ui;
    const ink=tone('#20160e'), gold=tone('#e2bd72'),dim=tone('#a69776');
    U.rect('SummonBackdrop',0,0,720,1280,ink);
    U.panel('GemBalance',-179,567,337,63,ink,29,tone('#6d4e2a'));
    U.text('GemBalanceText',`元宝 ${fmt.fmtNum(s.res.gem)}`,-179,567,310,26,gold);
    U.panel('ScrollBalance',179,567,337,63,ink,29,tone('#6d4e2a'));
    U.text('ScrollBalanceText',`招募令 ${s.res.scroll}`,179,567,310,26,gold);
    U.panel('SummonHall',0,206,686,594,tone('#2f2114'),19,tone('#ab7e36'));
    U.panel('SummonInner',0,206,668,576,tone('#342518'),13,tone('#60441f'));
    U.text('SummonHallTitle','召唤 · 点将台',0,418,600,53,gold);
    U.text('SummonHallSubtitle','聚天下英杰 · 成千秋霸业',0,362,590,23,dim);
    U.scene('SummonSealArt',g=>{
      g.strokeColor=tone('#765a30');g.lineWidth=4;g.circle(0,209,118);g.stroke();
      for(let i=0;i<12;i++){
        const a=i*Math.PI/6;
        g.moveTo(Math.cos(a)*135,209+Math.sin(a)*135);
        g.lineTo(Math.cos(a)*182,209+Math.sin(a)*182);
      }
      g.stroke();
    });
    U.panel('SummonSeal',0,209,90,90,tone('#57402d'),12,gold);
    U.text('SummonSealText','将',0,209,83,55,gold);
    U.text('SummonRates','概率  SSR 2% · SR 10% · R 28% · N 60%',0,-26,630,24,dim);
    U.panel('SummonPool',0,-150,686,165,tone('#322318'),13,tone('#735634'));
    U.text('PoolTitle',`武将池 · ${heroData.HEROES.length} 将 · 固定概率，无保底`,-74,-101,590,22,dim);
    const rarity:[string,string,number][]=[['SSR','#e2b95f',4],['SR','#b37ac9',3],['R','#5f90c8',2],['N','#b9bec3',1]];
    rarity.forEach(([name,hex],i)=>{
      const x=-264+i*175;
      U.panel('RarityMark'+i,x-47,-158,24,24,tone(hex),2);
      U.text('RarityName'+i,name,x+4,-158,83,24,tone(hex));
    });
    U.text('PoolCounts',rarity.map(([name,,level])=>`${name} ${heroData.HEROES.filter((h:any)=>h.rarity===level).length}`).join(' · '),0,-209,610,19,dim);
    const draws:[string,string,string,string,()=>void][]=[
      ['Single','招募 ×1','招募令 ×1','#392719',()=>ctx.confirm('确认招募','消耗招募令 ×1',()=>ctx.summonDraw('scroll1'))],
      ['TenScroll','招募 ×10','招募令 ×10','#d9ac5f',()=>ctx.confirm('确认招募','消耗招募令 ×10',()=>ctx.summonDraw('scroll10'))],
      ['TenGem','元宝十连',`元宝 ×${config.GACHA.costTenGold}`,'#d9ac5f',()=>ctx.confirm('确认招募',`消耗元宝 ×${config.GACHA.costTenGold}`,()=>ctx.summonDraw('gem10'))]
    ];
    draws.forEach(([id,title,cost,hex,action],i)=>{
      const x=-232+i*232,bg=tone(hex),dark=i===0;
      U.panel(id,x,-323,214,139,bg,12,gold);
      U.text(id+'Title',title,x,-303,194,30,dark?gold:ink);
      U.text(id+'Cost',cost,x,-351,194,18,dark?dim:tone('#573d1e'));
      U.tap(id+'Tap',x,-323,214,139,action);
    });
    U.panel('SummonAd',0,-457,678,70,tone('#2b1e12'),11,tone('#ad7e39'));
    U.text('SummonAdText','看广告得招募令 ×1',0,-457,618,23,gold);
    U.tap('SummonAdTap',0,-457,678,70,()=>ctx.playAd('summon',()=>{
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
    const gold=tone('#e4bd73'),paper=tone('#f0dfbd'),dim=tone('#ac9776');
    U.rect('ResultBackdrop',0,0,720,1280,tone('#20160e'));
    U.text('DrawHeading','招募结果',0,545,610,45,gold);
    U.text('DrawSubheading',`本次获得 ${ctx.lastSummon.length} 名武将 · 点击查看详情`,0,493,620,21,dim);
    ctx.lastSummon.forEach((result: any, i: number) => {
      const hero = heroData.getHero(result.id);
      if (!hero) return;
      const x = ctx.lastSummon.length === 1 ? 0 : (i % 2 ? 168 : -168);
      const y = ctx.lastSummon.length === 1 ? 45 : 383 - Math.floor(i / 2) * 166;
      const rarity = ['','N','R','SR','SSR'][hero.rarity] || 'N';
      const openHero = () => { ctx.selectedHeroId=result.id; ctx.go('heroDetail'); };
      const single=ctx.lastSummon.length===1;
      const accent=hero.rarity>=4?tone('#e2b15e'):hero.rarity>=3?tone('#ad79b8'):hero.rarity>=2?tone('#6d9bc8'):tone('#afb5aa');
      U.panel('DrawCard'+i,x,y,single?468:320,single?506:148,tone('#312319'),12,accent);
      U.panel('DrawAvatar'+i,single?x:x-102,single?y+62:y, single?224:98,single?270:112,tone('#364539'),10,accent);
      U.text('DrawGlyph'+i,hero.surname||hero.name[0],single?x:x-102,single?y+62:y,single?180:82,single?107:65,paper);
      U.text('DrawName'+i,`${rarity} · ${hero.name}`,single?x:x+49,single?y-102:y+31,single?370:196,27,accent);
      U.text('DrawStatus'+i,result.isNew?'新武将已入队':result.autoStar?'重复卡 · 已自动升星':'重复卡 · 已存入同名卡',single?x:x+51,single?y-161:y-32,single?390:200,17,dim);
      U.tap('DrawCardTap'+i,x,y,single?468:320,single?506:148,openHero);
    });
    U.panel('DrawContinue',-169,-477,298,70,tone('#d9ad61'),9,gold);
    U.text('DrawContinueText','继续招募',-169,-477,275,26,tone('#312015'));
    U.tap('DrawContinueTap',-169,-477,298,70,()=>ctx.go('summon'));
    U.panel('DrawRoster',169,-477,298,70,tone('#3d6653'),9,gold);
    U.text('DrawRosterText','查看群英',169,-477,275,26,paper);
    U.tap('DrawRosterTap',169,-477,298,70,()=>ctx.go('heroes'));
  }

export function armory(ctx: ScreenContext) {
    const s=store.getState(),U=ctx.ui;
    const gold=tone('#e4bd73'),paper=tone('#f0dfbd'),dim=tone('#ac9776');
    ctx.title('全军军械',`精铁 ${s.res.iron} · 铜钱 ${fmt.fmtNum(s.res.gold)} · 六部位全军生效`);
    U.text('ArmoryIntro','一套军械，全体英雄同时生效',0,378,620,20,dim);
    items.ARMORY_SLOTS.forEach((slot: any,i: number)=>{
      const selected: any=items.CATALOG.find((x: any)=>x.id===s.armory.selected[slot.id]);
      const x=i%2?169:-169,y=243-Math.floor(i/2)*204;
      U.panel('Armory'+i,x,y,316,184,tone('#312218'),10,tone('#957139'));
      U.text('ArmorySlot'+i,slot.name,x-70,y+62,140,25,gold);
      U.text('ArmoryStar'+i,`★${s.armory.slotStars[slot.id]||0}`,x+98,y+62,75,23,gold);
      U.text('ArmoryItem'+i,selected?.name||'未装备',x,y+9,284,23,selected?.q>=2?gold:paper);
      const stats=selected?Object.entries(selected.stats).map(([key,value])=>`${key==='atk'?'攻击':key==='hp'?'生命':'防御'} +${Math.round(Number(value)*100)}%`).join(' · '):'查看图鉴解锁军械';
      U.text('ArmoryStats'+i,stats,x,y-31,276,17,dim);
      U.text('ArmoryView'+i,'查看图鉴 ›',x,y-69,275,18,gold);
      U.tap('ArmoryTap'+i,x,y,316,184,()=>{
        ctx.selectedArmorySlot=slot.id;ctx.go('armoryCatalog');
      });
    });
    const boxes=[1,2,3].map(q=>s.armory.boxes[q]||0);
    if(boxes.some(Boolean)) U.button('ArmoryBoxes',`军械自选箱待领取 · ${boxes.reduce((a,b)=>a+b,0)}`,
      0,-477,470,67,()=>{
        ctx.selectedBoxQ=boxes.findIndex(Boolean)+1;
        ctx.go('armoryBox');
      },palette.gold);
    else U.text('BoxHint','名将关第 10 / 30 / 60 关可获得军械自选箱',0,-477,620,18,dim);
  }

export function armoryCatalog(ctx: ScreenContext) {
    const slot=items.ARMORY_SLOTS.find((x: any)=>x.id===ctx.selectedArmorySlot), s=store.getState(), U=ctx.ui;
    const star=s.armory.slotStars[ctx.selectedArmorySlot]||0;
    ctx.title(`${slot?.name}图鉴`,`部位 ★${star} · 精铁 ${s.res.iron} · 点击条目解锁或启用`);
    items.CATALOG.filter((x: any)=>x.slot===ctx.selectedArmorySlot).forEach((item: any,i: number)=>{
      const owned=!!s.armory.unlocked[item.id], active=s.armory.selected[ctx.selectedArmorySlot]===item.id;
      ctx.row('Catalog'+i,`${item.name} · ${items.GRADES[item.q].name} · ${active?'已启用':owned?'已解锁':'未解锁'}`,353-i*111,()=>{
        if(active){ctx.notice='当前军械已启用';ctx.show('armoryCatalog');return;}
        if(owned)return ctx.tell(store.armorySelect(ctx.selectedArmorySlot,item.id),`已启用 ${item.name}`);
        ctx.confirm('解锁军械',`消耗精铁 ${items.GRADES[item.q].cost}，解锁 ${item.name}`,()=>ctx.tell(store.armoryUnlock(item.id),`已解锁 ${item.name}`));
      });
    });
    U.button('UpgradeSlot','部位升星',-175,-405,286,74,()=>ctx.confirm('部位升星',star>=5?'已满星':`消耗精铁 ${items.STAR_NEEDS[star]} · 铜钱 ${items.STAR_GOLD[star]}`,()=>ctx.tell(store.armoryUpgrade(ctx.selectedArmorySlot),'升星成功')),palette.gold);
    U.button('ArmoryBack','返回军械',175,-405,286,74,()=>ctx.go('armory'),palette.paperDark);
  }

export function armoryBox(ctx: ScreenContext) {
  const s=store.getState(), q=ctx.selectedBoxQ, count=s.armory.boxes[q]||0;
  ctx.title('军械自选箱',`${items.GRADES[q].name}箱 ×${count} · 选择尚未解锁的军械`);
  [1,2,3].forEach((grade,i)=>ctx.ui.button('BoxGrade'+grade,
    `${items.GRADES[grade].name} ×${s.armory.boxes[grade]||0}`,-220+i*220,355,205,66,
    ()=>{ctx.selectedBoxQ=grade;ctx.show('armoryBox');},grade===q?palette.gold:palette.paperDark));
  const pool=items.CATALOG.filter((item: any)=>item.q===q);
  pool.forEach((item: any,i: number)=>{
    const owned=!!s.armory.unlocked[item.id];
    ctx.row('BoxItem'+i,`${item.name} · ${items.ARMORY_SLOTS.find((slot: any)=>slot.id===item.slot)?.name||''} · ${owned?'已解锁':'可选择'}`,
      255-i*100,()=>{
        if(owned)return ctx.tell({ok:false,msg:'该军械已经解锁'},'');
        if(count<=0)return ctx.tell({ok:false,msg:'当前品质没有可使用的军械箱'},'');
        ctx.confirm('使用军械自选箱',`消耗 ${items.GRADES[q].name}箱 ×1，获得 ${item.name}`,
          ()=>ctx.tell(store.armoryClaimBox(q,item.id),`已解锁 ${item.name}`));
      },owned?'已拥有':count>0?'领取':'无箱');
  });
  if(count>0&&pool.every((item: any)=>s.armory.unlocked[item.id]))
    ctx.ui.button('BoxConvert','图鉴已齐 · 转为精铁',-160,-456,292,70,()=>ctx.confirm('转换军械箱',
      `将 ${items.GRADES[q].name}箱 ×1 转为精铁`,()=>ctx.tell(store.armoryClaimBox(q,'convert'),'已转换精铁')),palette.gold);
  ctx.ui.button('BoxBack','返回军械',count>0&&pool.every((item: any)=>s.armory.unlocked[item.id])?162:0,-456,292,70,
    ()=>ctx.go('armory'),palette.paperDark);
}
