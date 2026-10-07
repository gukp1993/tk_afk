import { Color, LabelOutline, Tween, UIOpacity, Vec3 } from 'cc';
import { CocosUi, hexColor as tone, rarityColors } from '../ui/CocosUi';
import { ScreenContext } from './ScreenContext';
import * as store from '../domain/store';
import * as stages from '../domain/stages';
import * as story from '../domain/story';
import * as items from '../domain/items';
import * as config from '../domain/config';
import * as fmt from '../domain/fmt';
import * as progression from '../domain/progression';
import * as heroData from '../domain/heroes';
import { firstTimeOverlay } from './TutorialOverlay';
import { AutoSummary } from '../services/AutoBattleSession';
import { ArtService } from '../services/ArtService';

let battleDetailOpen=false;
let resultFxPlayed:any=null; // A5（规格 6.5-4）：同一 outcome 只播一次大字入场/描边闪（战报详情等重入不重播）
const GOLD=tone('#e3ba70'), PAPER=tone('#f0dfbd'), DIM=tone('#a69776');
const BG=tone('#1d120b');
const GREEN=tone('#7fbd94'), RED=tone('#bb614c');

function fighterPosition(side: string, slot: number): [number, number] {
  // 左右对垒的三前二后阵型，五行错开，给全身立绘和头顶状态条留足空间。
  const rowY=[280,140,0,-140,-280];
  const isBack=slot===1||slot===3;
  const x=side==='A'?(isBack?-275:-215):(isBack?275:215);
  return [x,rowY[slot] ?? rowY[slot%5]];
}

function battleTitle(ctx: ScreenContext) {
  if(ctx.battleMode==='campaign') {
    const stage=stages.makeStageEnemies(ctx.battleIndex);
    return `第 ${ctx.battleIndex} 关 · ${stage.name}`;
  }
  if(ctx.battleMode==='expedition')return '远征 · 第 '+ctx.battleIndex+' 层';
  if(ctx.battleMode==='weekboss')return '决战 · '+(store.weekBossInfo().bossName||'本周魔王');
  if(ctx.battleMode==='scene')return '名场面 · '+(ctx.battleSceneName||'');
  if(ctx.battleMode==='quad')return '四方台 · 第 '+ctx.battleIndex+' 层';
  if(ctx.battleMode==='trial'){
    const t=(store as any).trialInfo((ctx as any).trialHeroId||'');
    return '名将试炼 · '+(t?t.name:'');
  }
  if(ctx.battleMode==='hall')return '名人堂挑战';
  return ({tower:'群英塔',training:'连续练兵',arena:'演武场'} as Record<string,string>)[ctx.battleMode] || '战斗';
}

function returnPage(ctx: ScreenContext) {
  return ctx.battleMode==='arena'?'arena':ctx.battleMode==='tower'?'tower':ctx.battleMode==='quad'?'journey':ctx.battleMode==='trial'?'heroes':ctx.battleMode==='scene'||ctx.battleMode==='seasonScenes'?'season':ctx.battleMode==='expedition'||ctx.battleMode==='hall'?'journey':'campaign';
}

function drawFighter(U: CocosUi, unit: any, index: number) {
  const [x,y]=fighterPosition(unit.side,unit.slot ?? index%5);
  const hero=unit.heroId?heroData.getHero(unit.heroId):null;
  const rarity=hero?.rarity||1;
  // 保留 Fighter + FighterGlyph 两个 BattleFx 驱动锚点；画面主体改为完整竖版立绘。
  U.panel(`Fighter${index}`,x,y-65,78,16,new Color(7,10,13,125),8,tone(rarityColors[rarity]),false);
  U.battleFigure(`FighterGlyph${index}`,x,y,112,146,{
    heroId:hero?unit.heroId:undefined,faction:unit.faction||hero?.faction,rarity,faceRight:unit.side==='A'
  });
  if(unit.cc)U.text(`FighterCC${index}`,'✦',x+42,y+62,25,18,GOLD);
  U.progress(`HP${index}`,x,y+79,88,unit.hp/unit.maxHp,unit.side==='A'?GREEN:RED);
  U.progress(`Energy${index}`,x,y+67,88,(unit.energy||0)/100,GOLD);
  U.text(`FighterName${index}`,unit.alive?unit.name:`${unit.name} · 阵亡`,x,y-78,108,16,unit.side==='A'?GOLD:DIM);
}

function battleTimerInfo(ctx: ScreenContext): { text: string; urgent: boolean } {
  const dur=ctx.fighting?.result()?.duration||ctx.outcome?.duration||0;
  const left=Math.max(0,config.BATTLE.TIME_LIMIT-Math.floor(dur));
  const ot=config.BATTLE.OVERTIME;
  const raging=!!(ot&&dur>ot.start);
  return { text:`⌛ ${left}s${raging?' · 狂暴':''}`, urgent:left<15||raging };
}

function drawField(U: CocosUi, ctx: ScreenContext, snapshot: any[]) {
  U.rect('BattleBackdrop',0,0,720,1280,BG);
  const field=ArtService.frame('bg_main');
  if(field){
    U.image('BattleBackdropArt',field,0,0,720,1280);
    U.rect('BattleBackdropShade',0,0,720,1280,new Color(9,15,18,118));
  }
  U.panel('BattleHeader',0,590,696,88,new Color(14,22,25,218),10,undefined,false);
  U.text('BattleTitle',battleTitle(ctx),-75,592,510,27,GOLD);
  const timer=battleTimerInfo(ctx);
  U.text('BattleTimer',timer.text,282,592,138,23,timer.urgent?RED:PAPER);
  U.scene('BattleCenterLine',g=>{
    g.strokeColor=tone('#795b34');g.lineWidth=2;
    g.moveTo(-330,8);g.lineTo(330,8);g.stroke();
  });
  U.panel('BattleVsBg',0,8,108,34,new Color(14,22,25,224),4,GOLD,false);
  U.text('BattleVs','对 阵',0,8,92,18,PAPER);
  U.text('EnemyBannerText','敌 军',215,462,128,20,tone('#bad1e4'));
  U.text('AllyBannerText','我 军',-215,-440,128,20,GOLD);
  // 输出对比放在中轴空带：原 y=-437/-455 与后排卡面、血怒条重叠，倍速重绘时尤其明显。
  {
    const tt=(ctx.fighting&&(ctx.fighting as any).sideTotals)?((ctx.fighting as any).sideTotals()):null;
    if(tt&&(tt.a>0||tt.b>0)){
      const total=Math.max(1,tt.a+tt.b);
      const wA=Math.max(0.06,tt.a/total), wB=1-wA;
      U.rect('DmgBarBkg',0,-486,600,10,new Color(20,14,10,200));
      U.rect('DmgBarA',-300+300*wA,-486,600*wA,10,new Color(120,180,130,220));
      U.rect('DmgBarB',-300+600*wA+300*wB,-486,600*wB,10,new Color(190,90,80,220));
      U.text('DmgBarTxt',`我军输出 ${fmt.fmtNum(tt.a)} · 敌军 ${fmt.fmtNum(tt.b)}`,0,-465,600,14,tone('#b8a888'));
    }
  }
  snapshot.forEach((unit,index)=>drawFighter(U,unit,index));
  // 伤害数字与大招横幅已迁入 BattleFx 每帧管线（A0）：此处整页重绘才执行的死路渲染已删除
}

export function battleView(ctx: ScreenContext) {
  const U=ctx.ui;
  if(!ctx.fighting)return;
  drawField(U,ctx,ctx.fighting.snapshot());
  if(ctx.auto){
    U.panel('AutoStatus',0,-580,678,116,tone('#281b13'),10,GOLD);
    U.text('AutoStatusTitle',ctx.autoStopPending?'本场结束后停止':'自动出征进行中',0,-542,620,23,GOLD);
    U.text('AutoStatusDetail',`第 ${ctx.battleIndex} 关 · 战斗中`,0,-573,615,17,DIM);
    U.button('AutoSpeed',`×${store.getState().settings.autoBattleSpeed||1}`,-240,-606,118,38,()=>changeSpeed(ctx),tone('#443024'));
    U.button('AutoStopAfter','本场后停止',-39,-606,246,38,()=>ctx.stopAuto(true),tone('#443024'));
    U.button('AutoStop','立即停止',238,-606,170,38,()=>ctx.stopAuto(false),tone('#443024'));
  }else{
    U.button('Retreat','撤退',-245,-594,132,58,()=>ctx.go(returnPage(ctx)),tone('#443024'));
    U.button('Speed',`加速 ×${store.getState().settings.autoBattleSpeed||1}`,-45,-594,190,58,()=>changeSpeed(ctx),tone('#443024'));
    U.button('Skip','跳过战斗',219,-594,208,58,()=>ctx.skipBattle(),tone('#b78b43'));
  }
}

function changeSpeed(ctx: ScreenContext) {
  const speed=store.getState().settings.autoBattleSpeed||1;
  store.setAutoBattleSpeed(speed===1?2:speed===2?4:1);
  ctx.show('battle');
}

export function refreshBattleView(ctx: ScreenContext) {
  if(!ctx.fighting)return;
  ctx.fighting.snapshot().forEach((unit: any,i: number)=>{
    const [x,y]=fighterPosition(unit.side,unit.slot ?? i%5);
    ctx.ui.updateProgressSmooth(`HP${i}`,x,y+79,88,unit.hp/unit.maxHp,0.14);
    ctx.ui.updateProgressSmooth(`Energy${i}`,x,y+67,88,(unit.energy||0)/100,0.12);
    ctx.ui.setText(`FighterName${i}`,unit.alive?unit.name:`${unit.name} · 阵亡`);
  });
  ctx.ui.setText('BattleTimer',battleTimerInfo(ctx).text);
}

// 败北诊断：取终局快照里存活敌方的最高血量占比，给一条可执行提示（我方被团灭时同样带血量信息）
function defeatDiag(ctx: ScreenContext, r: any, brief=false): string {
  const foes=(ctx.lastBattleSnapshot||[]).filter((u:any)=>u.side==='B'&&u.alive)
    .sort((a:any,b:any)=>(b.hp/b.maxHp)-(a.hp/a.maxHp));
  const top=foes[0];
  const topPct=top?Math.round(top.hp/top.maxHp*100):null;
  const timedOut=(r?.duration||0)>=config.BATTLE.TIME_LIMIT;
  if(topPct===null)return brief?'我方全灭 · 敌阵完好':'我方全灭 · 尝试克制阵营或升级军械';
  if(brief)return `${top.name} 仍剩 ${topPct}% 血`;
  if(topPct<=15)return `${top.name}只剩 ${topPct}% 血 · 再强化一轮即可过关`;
  if(timedOut)return `${top.name}仍剩 ${topPct}% 血 · 输出不足，试试克制阵营（魏→蜀→吴→群→魏）或升级军械`;
  return `我方被击败 · ${top.name}仍剩 ${topPct}% 血 · 试试克制阵营或调整布阵`;
}

// P4 挑战评级：我方阵亡数取终局快照（含借义从 6 席口径准确）；仅胜局调用，败北/回放由调用方 gating
function battleDeaths(ctx: ScreenContext): number {
  return (ctx.lastBattleSnapshot||[]).filter((u:any)=>u.side==='A'&&!u.alive).length;
}

export function resultView(ctx: ScreenContext) {
  const r=ctx.outcome,U=ctx.ui;
  drawField(U,ctx,ctx.lastBattleSnapshot||[]);
  U.rect('ResultDim',0,0,720,1280,new Color(0,0,0,215)); // R7：加深压暗，结算面板外不再透出可辨残像
  U.panel('ResultPanel',0,-12,572,540,tone('#271b13'),16,GOLD);
  const resultTitle=U.text('ResultTitle',(r&&r.replay?'【回放】':'')+(r?.win?'凯  旋':'败  北'),0,174,514,56,r?.win?GOLD:DIM);
  // 胜负大字入场（2026-10-03 动画线先行批，纯表现层）：缩放 1.6→1 回弹 + 淡入；
  // A5 收尾：同一 outcome 只播一次（6.5-4）+ 胜利金描边 1→3→1 闪一次（败北不闪）
  if (resultFxPlayed!==r) {
    resultFxPlayed=r;
    const titleOp=resultTitle.addComponent(UIOpacity);
    titleOp.opacity=0;
    resultTitle.setScale(new Vec3(1.6,1.6,1));
    new Tween(resultTitle).to(0.28,{scale:new Vec3(1,1,1)},{easing:'backOut'}).start();
    new Tween(titleOp).to(0.22,{opacity:255}).start();
    const ol=resultTitle.getComponent(LabelOutline);
    if(r?.win&&ol)new Tween(ol).to(0.14,{width:3},{easing:'backOut'}).to(0.16,{width:1}).start();
  }
  const reward=r?.reward||{};
  // 处方单提前计算（败北行是否用 brief 诊断取决于处方是否激活）
  let rx:any=null;
  if(!ctx.auto&&ctx.battleMode==='campaign'&&r&&!r.win&&!r.replay&&config.DEFEAT_RX.enabled){
    const enemyFactions=(stages.makeStageEnemies(ctx.battleIndex).units||[]).map((u:any)=>u.hero&&u.hero.faction);
    rx=progression.buildDefeatPrescriptions(store.getState(),{
      questList:store.questList,idlePending:store.idlePending,bountyInfo:store.bountyInfo,summonPityInfo:store.summonPityInfo,borrowInfo:store.borrowInfo
    },{duration:r.duration||0,snapshot:ctx.lastBattleSnapshot||[],enemyFactions});
  }
  let diagBrief=!!rx;
  // 满级经验转铜钱（2026-10-02 裁决三 A）：结算行追加折算提示
  const xpGoldNote=(r&&r.convertedXP||0)>0?` · 满级转铜钱 +${fmt.fmtNum(r.convertedXP||0)}`:'';
  let lines: string[]=[];
  if(r&&r.replay) lines=[`复盘 · ${r.replayName||'对局回放'}`,`用时 ${Math.round((r.duration||0)*10)/10} 秒`];
  else if(!r?.ok) lines=[r?.msg||'结算失败'];
  else if(ctx.battleMode==='arena'){
    const fmtBonus=(b:any)=>b?Object.keys(b).map((k:string)=>({gold:'铜钱',gem:'元宝',token:'演武令',seals:'印信'} as any)[k]?`${({gold:'铜钱',gem:'元宝',token:'演武令',seals:'印信'} as any)[k]}+${fmt.fmtNum((b as any)[k])}`:'').filter(Boolean).join('·'):'';
    lines=r?.win?[`演武积分 ${reward.delta>=0?'+':''}${reward.delta||0}${reward.firstWinBonus?'（首胜 ×1.5）':''} · 演武令 +${reward.tokens||0}`,
      ...(reward.weekRankUp?[`周段位奖 ${reward.weekRankUp.name}：${fmtBonus(reward.weekRankUp)}`]:[]),
      ...(reward.rankUp?[`首达 ${reward.rankUp.name}！元宝 +${reward.rankUp.gem} · 精铁 +${reward.rankUp.iron}`]:[])]
    :[defeatDiag(ctx,r),`演武积分 ${reward.delta||0} · 演武令 +${reward.tokens||0}`];
  }
  else if(ctx.battleMode==='tower') lines=r?.win?[`元宝 +${reward.gem||0} · 精铁 +${reward.iron||0} · 招募令 +${reward.scroll||0}`,`武将碎片 +${reward.shard||0}`]:[defeatDiag(ctx,r)];
  else if(ctx.battleMode==='hall'){
    const hr=reward.hallReward||{};
    if(!r?.win) lines=[defeatDiag(ctx,r),'名人堂挑战不限次数'];
    else {
      const parts:string[]=[];
      if(hr.firstKill)parts.push('首杀荣耀 +'+(hr.firstKillHonor||0));
      if(hr.firstThreeStar)parts.push('三星评价 +'+(hr.threeStarHonor||0)+' 荣耀 · 碎片 +'+(hr.shard||0));
      if(hr.weeklyClear)parts.push('周全胜！演武令 +'+hr.token);
      lines=[parts.join(' · ')||'挑战成功（重复挑战不发奖）',`名人堂荣耀 ${((store as any).hallInfo().honor)}${reward.rating?' · 评级 '+reward.rating:''}`];
      if(hr.title)lines.push('获得称号：'+hr.title);
    }
  }
  else if(ctx.battleMode==='training') lines=[`练兵经验 +${r.gainedXP||0}${xpGoldNote}`];
  else if(ctx.battleMode==='weekboss'){
    const wbr=reward||{};
    lines=[`对魔王输出：${fmt.fmtNum(wbr.damage||0)}（占血量 ${((wbr.pct||0)*100).toFixed(1)}%）`,
      wbr.improved?`刷新本周纪录！`:`本周最高 ${(store.weekBossInfo().bestPct*100).toFixed(1)}%`,
      `档位奖：${Object.entries(wbr.reward||{}).map(([k,n]:any)=>({seals:'印信',token:'演武令'} as any)[k]?`${({seals:'印信',token:'演武令'} as any)[k]}×${n}`:'').filter(Boolean).join(' · ')||'—'}`];
  }
  else if(ctx.battleMode==='dungeon'){
    const dr=reward||{};
    lines=r?.win?(dr.kind==='gold'?[`屯金第 ${dr.floor} 层通关 · 铜钱 +${fmt.fmtNum(dr.gold||0)}`]:[`屯兵第 ${dr.floor} 层通关 · 主公经验 +${dr.xpDirect||0}${xpGoldNote}${r.levelAfter>r.levelBefore?` · 升至 Lv.${r.levelAfter}`:''}`]):[defeatDiag(ctx,r),'军屯不计入主线进度 · 明日再来'];
  }
  else if(ctx.battleMode==='trial'){
    const tr=reward||{};
    lines=r?.win?(tr.first?[`首通荣耀 +${tr.honor||0} · 试炼「${(store as any).trialInfo((ctx as any).trialHeroId||'').name}」达成`,`当前荣耀 ${(store as any).hallInfo().honor}`]:['试炼成功（复习不发奖）']):['试炼不限次 · 调整编队再战',defeatDiag(ctx,r)];
  }
  else if(ctx.battleMode==='scene'){
    const sr=reward||{};
    lines=r?.win?(sr.slow?['敌军已重整旗鼓 · 超时未清（限 60 秒）',defeatDiag(ctx,r)]:sr.first?[`名场面「${sr.name}」达成 · 战功 +${sr.medal||0}`]:['名场面重演（已清 · 复演不发奖）']):['名场面败北 · 零损失再来',defeatDiag(ctx,r)];
  }
  else if(ctx.battleMode==='expedition'){
    const er=reward||{};
    lines=r?.win?[`远征第 ${er.floor||ctx.battleIndex} 层通关${er.first?' · 首通':''} · 印信 +${er.seals||0}`,
      er.milestoneSeals?`里程碑额外印信 +${er.milestoneSeals}`:'加护与词缀按周刷新 · 越深越厚']:['远征败北不发印信 · 调整编队再试',defeatDiag(ctx,r)];
  }
  else if(r?.win){
    if(reward.first){
      lines=[`元宝 +${reward.gem||0} · 铜钱 +${fmt.fmtNum(reward.gold||0)}${reward.scroll?` · 招募令 +${reward.scroll}`:''}`,
        `首通经验 +${r.gainedXP||0}${xpGoldNote}`];
    } else lines=[`铜钱 +${fmt.fmtNum(reward.gold||0)} · 经验 +${r.gainedXP||0}${xpGoldNote}`,'重复挑战不重复发放首通奖励'];
  }
  else lines=['普通奖励需凯旋后方可领取',defeatDiag(ctx,r,diagBrief)];
  lines.slice(0,3).forEach((line,i)=>U.text(`ResultLine${i}`,line,0,99-i*40,515,22,PAPER));
  // S1 败北台词「BOSS 的嘲弄」（第三轮；第四轮 S1 连败变奏）：campaign 败北渲染暗红气泡（处方单上方避让）。
  // 取句走 progression.pickBossTaunt：同关连败 ≥ config.TAUNT_VARIATION.after 换第二句（语气升级），
  // 右上角「· 再 X」徽标提示连败次数；胜局清零在 settleBattle；回放/自动链路不渲染。
  if(ctx.battleMode==='campaign'&&r&&!r.win&&!r.replay&&!ctx.auto&&config.DEFEAT_RX.enabled){
    const taunt=progression.pickBossTaunt((story as any).BOSS_TAUNTS,ctx.battleIndex,
      (store.getState().campaign.lossStreak||{})[ctx.battleIndex]||0);
    if(taunt&&taunt.text){
      const tHero=heroData.getHero(taunt.who);
      U.panel('TauntBubble',0,258,560,64,tone('#3a1512'),16,tone('#a8433a'));
      U.text('TauntWho',`${tHero?tHero.name:taunt.who}：`,0,272,520,17,tone('#c9827a'));
      U.text('TauntText',`「${taunt.text}」`,0,246,520,19,tone('#e8b8ad'));
      if(taunt.variant===2)U.text('TauntStreak',`· 再${taunt.streak}`,236,272,68,14,tone('#c96a5e'));
    }
  }
  // 名将首通特写（战报中心 P3）：击败每章第 10 关名将的一次性文案，回放态不显示
  if(r?.win&&!r.replay&&ctx.battleMode==='campaign'&&reward.first&&stages.makeStageEnemies(ctx.battleIndex).isBoss){
    const bossName=stages.makeStageEnemies(ctx.battleIndex).units[0]?.hero?.name||'名将';
    const FLAVOR=[`${bossName}阵前授首 · 此关首破，威名入册`,`一战破${bossName} · 鼓角暂歇，前路已开`,`阵斩${bossName} · 首功记于麾下，三军喝彩`,`${bossName}授首 · 千军让道，此捷入青史`,`攻陷${bossName}大纛 · 关隘既克，声震此方`];
    let gloryText=FLAVOR[ctx.battleIndex%FLAVOR.length];
    // 每日 Boss 首杀宝箱（研讨会十一 S3）：与名将首通同触发，并入同一行避免占位
    if(reward.bossChest){
      const pkMap:any={shard:'武将碎片',scroll:'招募令',gem:'元宝'};
      const pkText=Object.entries(reward.bossChest.pick||{}).map(([k,n]:any)=>pkMap[k]?`${pkMap[k]}×${n}`:'').filter(Boolean).join('·');
      gloryText=`名将日宝箱：铜钱 +${fmt.fmtNum(reward.bossChest.gold)}${pkText?` · ${pkText}`:''} · 每日一次`;
    }
    U.text('ResultGlory',gloryText,0,130,514,18,GOLD);
  }
  // 战后台词气泡（剧情推图衔接批次二）：凯旋时在结算面板上方浮一条台词——
  // 名将关首通取该关对白末句（who 解析为武将名），普通关/重复挑战从出战阵容 quote 池
  // 按「关序号+日期」取模轮换（同日同关稳定、跨日换句）；败北/回放不显示。文案零新增。
  // 位置选面板上方压暗区（y=292，面板顶 244 之上），与面板内既有行零冲突，-548 红线内。
  if(r?.win&&!r.replay&&ctx.battleMode==='campaign'){
    const stageDef=stages.makeStageEnemies(ctx.battleIndex);
    const dlg=reward.first&&stageDef.isBoss?(((stageDef.story as any)?.stage?.dialogue)||[]).map((l:any)=>({
      who:(l.who&&heroData.getHero(l.who)?.name)||l.who||'',text:l.text
    })):null;
    const team=(ctx.lastBattleSnapshot||[]).filter((u:any)=>u.side==='A').map((u:any)=>{
      const h=u.heroId?heroData.getHero(u.heroId):null;
      return h&&h.quote?{name:String(u.name||'').replace('·义',''),quote:h.quote}:null;
    }).filter(Boolean);
    const quote=progression.battleResultQuote({dialogue:dlg,team,battleIndex:ctx.battleIndex,day:Math.floor(Date.now()/86400000)});
    if(quote){
      U.panel('ResultQuoteBg',0,292,620,52,new Color(20,14,10,222),26,GOLD);
      U.text('ResultQuote',`${quote.who}：「${quote.text}」`,0,292,592,20,GOLD);
    }
  }
  const msLabels=(reward.milestones||[]).map((m:any)=>m.label);
  if(r?.win&&reward.finale)U.text('ResultFinale','第一期主线完成 · 主线 120/120',0,14,500,24,GOLD);
  else if(r?.win&&msLabels.length){
    U.text('ResultMilestone',`里程碑：${msLabels.join('；')} >`,0,14,515,19,GOLD);
    U.tap('ResultMilestoneTap',0,14,515,30,()=>ctx.go(reward.milestones.some((m:any)=>m.kind==='armoryBox')?'armory':'bag'));
  }
  if(r?.win&&reward.first&&ctx.battleMode==='campaign'){
    const dropName=reward.armory&&!reward.armory.duplicate
      ?(items.CATALOG.find((x:any)=>x.id===reward.armory.itemId)?.name||'随机军械'):null;
    U.text('ResultDrop',dropName?`掉落军械：${dropName}`
      :reward.armory&&reward.armory.duplicate?(reward.armory.iron?`重复军械折算精铁 +${reward.armory.iron}`:'重复军械已入熔炉库存（可熔回/合成）')
      :'随机军械：本次未掉落（65% 概率）',0,-20,515,18,DIM);
  }
  if(r?.win&&reward.armoryBox)U.text('ResultBox',`${['','R','SR','SSR'][reward.armoryBox]||''}军械自选箱 ×1 · 待选择`,0,-46,480,19,GOLD);
  // P4 评星旁挑战评级（第三轮）：星级读结算 reward.stars（r.stars 从未赋值，历史恒显 ★1 的显示缺陷一并修正）
  const starText=ctx.battleMode==='campaign'&&r?.win?`评星 ${'★'.repeat(Math.max(1,Math.min(3,reward.stars||r.stars||1)))} · `:'';
  // P4 名将关挑战评级（第三轮）：评星旁纯展示——S=限时内胜且零阵亡 / A=限时内胜或零阵亡 / B=其余胜局；回放无评级
  const ratingText=ctx.battleMode==='campaign'&&r?.win&&!r.replay&&stages.makeStageEnemies(ctx.battleIndex).isBoss
    ?`评级 ${progression.challengeRating(r.duration||0,battleDeaths(ctx))} · `:'';
  U.text('ResultDuration',`${starText}${ratingText}用时 ${Math.round((r?.duration||0)*10)/10} 秒`,0,-96,470,19,DIM);
  // DPS 结算榜（研讨会八方案 5）：数据已就绪，复用 settled.stats 按输出排序 TOP3
  if(r?.stats&&r.win){
    const dps=Object.entries(r.stats as Record<string,{dmg:number}>)
      .filter(([uid])=>uid.charAt(0)==='A')
      .sort((a,b)=>b[1].dmg-a[1].dmg).slice(0,3);
    if(dps.length&&dps[0][1].dmg>0){
      const names=(ctx.lastBattleSnapshot||[]).filter((u:any)=>u.side==='A');
      const dpsText=dps.map(([uid,st])=>{
        const u=names.find((n:any)=>n.uid===uid);
        return (u?u.name:uid)+' '+fmt.fmtNum(st.dmg);
      }).join(' · ');
      U.text('ResultDPS','输出前三：'+dpsText+' · 详情 >',0,-68,500,16,GOLD);
      U.tap('ResultDPSTap',0,-68,500,30,()=>{battleDetailOpen=true;ctx.show('result');});
    }
  }
  if(r&&r.replay){
    U.button('ResultCloseReplay','关闭回放',0,-165,478,59,()=>ctx.go('hall'),tone('#3a2b20'));
  } else {
    U.button('ResultShare','传 檄',-139,-228,232,53,()=>{
      const st2=stages.makeStageEnemies(ctx.battleIndex);
      const vanguard=((ctx.lastBattleSnapshot||[]).filter((u:any)=>u.side==='A').slice(0,2).map((u:any)=>u.name.replace('·义',''))) .join('、')||'众将';
      const title=`讨伐檄文 · 已克 ${ctx.battleIndex} 关 · ${vanguard}为先驱，邀同袍共讨国贼`;
      const ci=(store as any).companionInfo();
      ctx.shareResult(title,'t=xw&c='+ci.code+'&s='+ctx.battleIndex);
      (store as any).companionMarkSent();
    },tone('#5a7a4c'));
  U.button('ResultBack','返回',-139,-165,232,59,()=>ctx.go(returnPage(ctx)),tone('#3a2b20'));
    U.button('ResultRetry','再战',139,-165,232,59,()=>ctx.battleMode==='arena'?ctx.startArenaBattle(ctx.battleDiff,ctx.battleArenaSeed):ctx.startBattle(ctx.battleMode,ctx.battleIndex,ctx.battleDiff),tone('#3a2b20'));
  }
  if(!ctx.auto){
    // 章节过场入口（批次四 ②）：首通章末关（第 10/20/…/160 关）后「挑战下一关」升级为
    // 「章末回顾 · 继续进军」，先过章末过场页再进新章首关（过场页可返回战役=可跳过）
    const chapterFinale=ctx.battleMode==='campaign'&&!!r?.win&&!!reward.first
      &&ctx.battleIndex%10===0&&ctx.battleIndex<=stages.CHAPTERS.length*stages.STAGES_PER_CH;
    if(ctx.battleMode==='campaign'&&!r?.win){
      // 卡关处方单（研讨会二 P1）：归因 + 按资源可完成度生成的处方按钮（rx 已在行文案前计算）
      if(rx){
        firstTimeOverlay(ctx,'rx');
        U.text('ResultHint',rx.attribution.text,0,-116,540,16,DIM);
        (rx.items as any[]).forEach((p:any,i:number)=>{
          U.button(i===0?'ResultGrowth':'ResultNext',p.text,-139+i*278,-228,232,53,()=>ctx.go(p.page as any),tone('#4c6e57'));
        });
      } else {
        const pity=store.summonPityInfo();
        U.text('ResultHint',`卡关提示：SSR 保底 ${pity.sinceSsr}/${pity.ssrHard} 抽 · 换克制阵营或升级军械后再战`,0,-116,540,16,DIM);
        U.button('ResultGrowth','推荐布阵',-139,-228,232,53,()=>ctx.go('formation'),tone('#4c6e57'));
        U.button('ResultNext','升级军械',139,-228,232,53,()=>ctx.go('armory'),tone('#4c6e57'));
      }
    } else {
      if(!r?.win)U.button('ResultGrowth','查看武将',-139,-228,232,53,()=>ctx.go('heroes'),tone('#4c6e57'));
      if(!r?.win&&ctx.battleMode==='arena'){
        // 演武败北：'再战'已可重打，不再重复渲染'重新挑战'
        U.text('ResultArenaTip','调整布阵或升级军械后再来切磋',139,-228,232,20,DIM);
      } else {
        U.button('ResultNext',chapterFinale?'章末回顾 · 继续进军':r?.win&&['campaign','tower'].includes(ctx.battleMode)?'挑战下一关':r?.win&&ctx.battleMode==='trial'?'返回英雄':r?.win?'返回玩法':'重新挑战',139,-228,232,53,()=>{
          if(chapterFinale)ctx.go('storyTransition');
          else if(r?.win&&ctx.battleMode==='campaign')ctx.startBattle('campaign',ctx.battleIndex+1);
          else if(r?.win&&ctx.battleMode==='tower')ctx.startBattle('tower',ctx.battleIndex+1);
          else if(r?.win)ctx.go(returnPage(ctx));
          else if(ctx.battleMode==='arena')ctx.startArenaBattle(ctx.battleDiff,ctx.battleArenaSeed);
          else ctx.startBattle(ctx.battleMode,ctx.battleIndex,ctx.battleDiff);
        },tone('#b78b43'));
      }
    }
  }else U.text('NextAuto','自动出征 · 即将继续',0,-218,500,22,GOLD);
  // 自动模式章节过场（批次四 ③）：首通章末关的结算停留期（resultDelay 1.5s）叠加章末回顾，
  // 随下一场开战自然掠过——不打断连战（P1），完整回顾可在剧情回顾页找回（P4）
  if(ctx.auto&&ctx.battleMode==='campaign'&&r?.win&&!!reward.first
    &&ctx.battleIndex%10===0&&ctx.battleIndex<=stages.CHAPTERS.length*stages.STAGES_PER_CH){
    const fin=story.getChapterTransition(ctx.battleIndex);
    const nextIntro=story.getChapterTransition(ctx.battleIndex+1);
    if(fin&&fin.kind==='finale'){
      // 近不透明压暗：结算面板/台词气泡不得透过过场横幅（实拍 D2 发现叠影，当批修掉）
      U.rect('CeremonyShade',0,0,720,1280,new Color(8,6,4,248));
      U.text('CeremonyChapter',stages.chapterOf(ctx.battleIndex).name,0,300,640,34,GOLD);
      U.text('CeremonyTag','— 章 末 回 顾 —',0,256,400,18,tone('#a99778'));
      U.textBlock('CeremonyText',fin.text,0,140,560,150,24,PAPER);
      if(nextIntro&&nextIntro.kind==='intro'&&nextIntro.text){
        U.text('CeremonyIntroTag','— 下章开篇 —',0,28,400,17,GOLD);
        U.textBlock('CeremonyIntro',nextIntro.text,0,-70,560,130,19,tone('#c9b489'));
      }
      U.text('CeremonyNext','休整片刻 · 即将进军下一章',0,-330,560,19,GOLD);
    }
  }
  // 战斗详情弹层（研讨会十）：点击 DPS 榜展开完整战报
  if(battleDetailOpen&&r?.stats){
    U.rect('BDShade',0,0,720,1280,new Color(10,8,6,220));
    U.tap('BDShadeTap',0,0,720,1280,()=>{battleDetailOpen=false;ctx.show('result');});
    U.panel('BDPanel',0,0,660,1000,tone('#2a1e12'),14,GOLD);
    U.text('BDTitle','战 斗 详 报',0,440,600,30,GOLD);
    const allStats=Object.entries(r.stats as Record<string,{dmg:number,heal:number}>)
      .filter(([uid])=>uid.charAt(0)==='A')
      .sort((a,b)=>b[1].dmg-a[1].dmg);
    allStats.forEach(([uid,st],i)=>{
      const y=380-i*52;
      if(y<-420)return;
      const unit=(ctx.lastBattleSnapshot||[]).find((u:any)=>u.uid===uid);
      const nm=unit?unit.name:uid;
      U.panel('BDRow'+i,0,y,620,44,tone('#1f1812'),6);
      U.text('BDName'+i,nm,-190,y,180,19,PAPER);
      U.text('BDDmg'+i,'输出 '+fmt.fmtNum(st.dmg),40,y,200,18,tone('#e8c47a'));
      U.text('BDHeal'+i,'治疗 '+fmt.fmtNum(st.heal),240,y,200,18,tone('#8fce9a'));
    });
    U.text('BDClose','点击任意处关闭',0,-440,500,18,DIM);
  }

}


export function autoSummary(ctx: ScreenContext, summary: AutoSummary) {
  const reason: Record<string,string>={
    'manual-stop':'已手动停止','stopped-after-battle':'本场结束后停止',
    'recovery-exhausted':'暂时受阻，收获材料后再战','training-loss':'练兵失败',
    'training-win-limit':'练兵次数已满','training-level-target':'达到本轮练兵目标',
    'level-max':'主公等级已满','replaced-by-battle':'已切换手动挑战'
  };
  const U=ctx.ui;
  U.rect('SummaryBackdrop',0,0,720,1280,BG);
  U.text('SummaryTitle','自动出征已停止',0,510,640,38,GOLD);
  U.text('SummaryReason',reason[summary.reason]||summary.reason||'本轮已结束',0,460,625,21,DIM);
  U.panel('SummaryPanel',0,31,648,725,tone('#291d15'),13,GOLD);
  U.text('SummaryStage',`关卡 ${summary.startStage} → ${summary.endStage}`,0,310,597,31,GOLD);
  U.text('SummaryBattles',`战斗 ${summary.battles} 场 · 胜 ${summary.wins} · 败 ${summary.losses}`,0,245,597,25,PAPER);
  U.text('SummaryTime',`用时 ${Math.floor(summary.elapsedSeconds/60)}分${summary.elapsedSeconds%60}秒`,0,189,597,21,DIM);
  U.panel('SummaryRewards',0,40,577,188,tone('#1f2e25'),9,tone('#8a7650'));
  U.text('SummaryRewardTitle','本轮收获',0,103,530,24,GOLD);
  U.text('SummaryGold',`铜钱 +${fmt.fmtNum(summary.gold)} · 元宝 +${summary.gem} · 招募令 +${summary.scroll}`,0,49,530,19,PAPER);
  U.text('SummaryXP',`经验 +${summary.xp} · 精铁 +${summary.iron}`,0,4,530,19,PAPER);
  U.text('SummaryLevel',`主公 Lv.${summary.startLevel} → Lv.${summary.endLevel}`,0,-113,550,21,DIM);
  U.text('SummaryRecent',summary.recent.join(' · '),0,-169,550,18,DIM);
  // 处方同源（处方单批次）：自动受阻时给「可立即完成」处方按钮
  if(summary.reason==='recovery-exhausted'){
    const enemyFactions=(stages.makeStageEnemies(ctx.battleIndex).units||[]).map((u:any)=>u.hero&&u.hero.faction);
    const rx=progression.buildDefeatPrescriptions(store.getState(),{
      questList:store.questList,idlePending:store.idlePending,bountyInfo:store.bountyInfo,summonPityInfo:store.summonPityInfo,borrowInfo:store.borrowInfo
    },{duration:0,snapshot:ctx.lastBattleSnapshot||[],enemyFactions});
    if(rx&&(rx.items as any[]).length){
      U.text('SummaryRxTitle','受阻处方 · 照做后再战',0,-224,550,18,GOLD);
      (rx.items as any[]).slice(0,2).forEach((p:any,i:number)=>{
        U.button('SummaryRx'+i,p.text,0,-276-i*56,560,48,()=>ctx.go(p.page as any),tone('#4c6e57'));
      });
    }
  }
  U.button('SummaryBack','返回战役',0,-405,430,78,()=>ctx.go('campaign'),tone('#b78b43'));
}
