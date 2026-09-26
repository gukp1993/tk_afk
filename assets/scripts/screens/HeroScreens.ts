import { palette } from '../ui/CocosUi';
import { Node } from 'cc';
import { ScreenContext } from './ScreenContext';
import * as store from '../domain/store';
import * as heroData from '../domain/heroes';
import * as items from '../domain/items';
import * as config from '../domain/config';
import * as fmt from '../domain/fmt';

export function heroes(ctx: ScreenContext) {
    const list = store.allRoster().sort((a: any,b: any)=>b.power-a.power);
    ctx.title('群英',`${list.length} 名武将 · 全队共享 Lv.${store.playerLevel()}`);
    list.slice(ctx.pageIndex*6,ctx.pageIndex*6+6).forEach((h: any,i: number)=>{
      const y=354-i*123;
      ctx.row('Hero'+i,`${h.name}  ★${h.star}  ·  战力 ${fmt.fmtNum(h.power)}`,y,()=>{ctx.selectedHeroId=h.id;ctx.go('heroDetail');},'详情');
    });
    ctx.ui.button('Prev','上一页',-165,-429,245,68,()=>{ctx.pageIndex=Math.max(0,ctx.pageIndex-1);ctx.show('heroes');},palette.paperDark);
    ctx.ui.button('Next','下一页',165,-429,245,68,()=>{ctx.pageIndex=Math.min(Math.floor((list.length-1)/6),ctx.pageIndex+1);ctx.show('heroes');},palette.paperDark);
    ctx.ui.button('HeroSummon','招募武将',0,-500,300,55,()=>ctx.go('summon'),palette.gold);
  }

export function heroDetail(ctx: ScreenContext) {
    const h: any=store.calcHero(ctx.selectedHeroId), owned=store.getOwned(ctx.selectedHeroId), choice=store.firstWinChoice();
    ctx.title(h.name,`${h.title} · ${h.faction} · ★${h.star} · 战力 ${fmt.fmtNum(h.power)}`);
    ctx.ui.rect('Portrait',0,265,630,235,palette.green);
    ctx.ui.text('HeroSurname',h.surname,0,280,190,105,palette.gold);
    ctx.row('Stats',`生命 ${fmt.fmtNum(h.stats.hp)} · 攻击 ${fmt.fmtNum(h.stats.atk)} · 防御 ${fmt.fmtNum(h.stats.def)}`,88);
    ctx.ui.text('Ult',`必杀 · ${h.ult.name}`,0,8,610,26,palette.gold);
    ctx.ui.text('UltDesc',h.ult.desc,0,-63,610,20,palette.paper);
    ctx.ui.text('Passive',`被动 · ${h.passiveDef.name}：${h.passiveDef.desc}`,0,-172,610,20,palette.paper);
    ctx.ui.text('HeroGrowth',`共享等级 Lv.${h.level} · 同名卡 ${owned.cards} · 自动升星`,0,-265,610,23);
    ctx.ui.button('LockCards',owned.lockedCards?'取消保护同名卡':'保护同名卡',-158,-370,286,76,()=>{
      const r=store.setCardsLocked(h.id,!owned.lockedCards);store.save();ctx.tell(r,r.locked?'同名卡已保护':'已取消保护');
    },palette.green);
    ctx.ui.button('HeroArmory','共享军械',160,-370,286,76,()=>ctx.go('armory'),palette.paperDark);
    if(choice.available&&['liubei','guanyu','zhangfei'].includes(h.id))
      ctx.ui.button('FirstWin','领取首胜自选武将',0,-452,440,67,()=>ctx.tell(store.claimFirstWinChoice(h.id),`已领取 ${h.name}`),palette.gold);
    else if((store.getState().vouchers[h.rarity===4?'ssr':'sr']||0)>0&&h.rarity>=3)
      ctx.ui.button('UseVoucher','使用英雄自选券',0,-452,440,67,()=>ctx.confirm('使用自选券',`选择 ${h.name}，获得该武将一张`,()=>ctx.tell(store.useChoiceVoucher(h.rarity,h.id),`获得 ${h.name}`)),palette.gold);
    else ctx.ui.button('HeroBack','返回群英',0,-452,340,67,()=>ctx.go('heroes'),palette.paperDark);
  }

export function summon(ctx: ScreenContext) {
    const s=store.getState(); ctx.title('点将台','SSR 2% · SR 10% · R 28% · N 60%');
    ctx.ui.rect('SummonHall',0,90,660,670,palette.green);
    ctx.ui.text('SummonSeal','将',0,190,230,130,palette.gold);
    ctx.ui.text('SummonBalance',`招募令 ${s.res.scroll}  元宝 ${s.res.gem}  已招 ${s.summon.total}`,0,0,620,24);
    ctx.ui.button('Single','单抽',-200,-270,275,95,()=>ctx.confirm('确认招募','消耗招募令 ×1',()=>ctx.summonDraw('scroll1')),palette.paperDark);
    ctx.ui.button('TenScroll','招募令十连',200,-270,275,95,()=>ctx.confirm('确认招募','消耗招募令 ×10',()=>ctx.summonDraw('scroll10')),palette.gold);
    ctx.ui.button('TenGem',`元宝十连 ${config.GACHA.costTenGold}`,0,-405,460,90,()=>ctx.confirm('确认招募',`消耗元宝 ×${config.GACHA.costTenGold}`,()=>ctx.summonDraw('gem10')),palette.red);
    ctx.ui.button('SummonAd','看广告得招募令',0,-500,410,61,()=>ctx.playAd('summon',()=>{
      store.applyReward({scroll:1});store.save();ctx.tell({ok:true},'获得招募令 ×1');
    }),palette.paperDark);
  }

export function summonDraw(ctx: ScreenContext, type: string) {
    const r=store.doSummon(type);
    if (!r.ok) return ctx.tell(r, '');
    ctx.lastSummon = r.results;
    ctx.go('summonResults');
  }

export function summonResults(ctx: ScreenContext) {
    ctx.title('招募结果', `本次获得 ${ctx.lastSummon.length} 名武将`);
    ctx.lastSummon.forEach((result: any, i: number) => {
      const hero = heroData.getHero(result.id);
      if (!hero) return;
      const x = ctx.lastSummon.length === 1 ? 0 : (i % 2 ? 162 : -162);
      const y = ctx.lastSummon.length === 1 ? 115 : 340 - Math.floor(i / 2) * 158;
      const rarity = ['','N','R','SR','SSR'][hero.rarity] || 'N';
      const openHero = () => { ctx.selectedHeroId=result.id; ctx.go('heroDetail'); };
      const card=ctx.ui.rect('DrawCard'+i, x, y, ctx.lastSummon.length === 1 ? 440 : 304, 137,
        hero.rarity >= 4 ? palette.gold : hero.rarity >= 3 ? palette.red : palette.green);
      const name=ctx.ui.text('DrawName'+i, `${rarity} · ${hero.name}`, x, y+24, 284, 28);
      const status=ctx.ui.text('DrawStatus'+i, result.isNew ? '新武将已入队' : result.autoStar ? '重复卡 · 已自动升星' : '重复卡 · 已存入同名卡', x, y-29, 284, 18);
      card.on(Node.EventType.TOUCH_END,openHero);
      name.on(Node.EventType.TOUCH_END,openHero);
      status.on(Node.EventType.TOUCH_END,openHero);
    });
    ctx.ui.button('DrawContinue','继续招募',-167,-480,282,72,()=>ctx.go('summon'),palette.gold);
    ctx.ui.button('DrawRoster','查看群英',167,-480,282,72,()=>ctx.go('heroes'),palette.green);
  }

export function armory(ctx: ScreenContext) {
    const s=store.getState(); ctx.title('共享军械',`精铁 ${s.res.iron} · 六部位全军生效`);
    items.ARMORY_SLOTS.forEach((slot: any,i: number)=>{
      const selected=items.CATALOG.find((x: any)=>x.id===s.armory.selected[slot.id]);
      ctx.row('Armory'+i,`${slot.name}  ${selected?.name || ''}  ★${s.armory.slotStars[slot.id] || 0}`,352-i*118,()=>{
        ctx.selectedArmorySlot=slot.id;ctx.go('armoryCatalog');
      });
    });
    const boxes=[1,2,3].map(q=>s.armory.boxes[q]||0);
    if(boxes.some(Boolean)) ctx.ui.button('ArmoryBoxes',`军械自选箱待领取 · ${boxes.reduce((a,b)=>a+b,0)}`,
      0,-435,470,75,()=>{
        ctx.selectedBoxQ=boxes.findIndex(Boolean)+1;
        ctx.go('armoryBox');
      },palette.gold);
    else ctx.ui.text('BoxHint','名将关第 10 / 30 / 60 关可获得军械自选箱',0,-435,620,20,palette.muted);
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
