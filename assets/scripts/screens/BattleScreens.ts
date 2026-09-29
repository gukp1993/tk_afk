import { Color } from 'cc';
import { CocosUi, hexColor as tone } from '../ui/CocosUi';
import { ScreenContext } from './ScreenContext';
import * as store from '../domain/store';
import * as stages from '../domain/stages';
import * as items from '../domain/items';
import * as config from '../domain/config';
import * as fmt from '../domain/fmt';
import { AutoSummary } from '../services/AutoBattleSession';

const GOLD=tone('#e3ba70'), PAPER=tone('#f0dfbd'), DIM=tone('#a69776');
const BG=tone('#1d120b'), CARD=tone('#2a1a18'), BLUE=tone('#4d91bd');
const PURPLE=tone('#a678c5'), GREEN=tone('#7fbd94'), RED=tone('#bb614c');

function fighterPosition(side: string, slot: number): [number, number] {
  const frontX=[-215,0,215], backX=[-114,114];
  // A 侧后排上移到 -405，给底部自动出征面板/按钮行让位（原 -467 会被面板盖住血条与名字）
  return slot<3 ? [frontX[slot],side==='A'?-208:245]
    : [backX[slot-3],side==='A'?-405:480];
}

function battleTitle(ctx: ScreenContext) {
  if(ctx.battleMode==='campaign') {
    const stage=stages.makeStageEnemies(ctx.battleIndex);
    return `第 ${ctx.battleIndex} 关 · ${stage.name}`;
  }
  if(ctx.battleMode==='expedition')return '远征 · 第 '+ctx.battleIndex+' 层';
  if(ctx.battleMode==='hall'){const hi=(stages as any).hallWeeklyLineups?null:null;return '名人堂 · '+((store as any).hallInfo().seats[ctx.battleIndex]||{}).name;}
  return ({tower:'群英塔',training:'连续练兵',arena:'演武场'} as Record<string,string>)[ctx.battleMode] || '战斗';
}

function returnPage(ctx: ScreenContext) {
  return ctx.battleMode==='arena'?'arena':ctx.battleMode==='tower'?'tower':ctx.battleMode==='expedition'||ctx.battleMode==='hall'?'expedition':'campaign';
}

function drawFighter(U: CocosUi, unit: any, index: number) {
  const [x,y]=fighterPosition(unit.side,unit.slot ?? index%5);
  const rim=unit.side==='A'?([GOLD,BLUE,PURPLE,GOLD,BLUE][unit.slot%5]):([PURPLE,BLUE,RED,PURPLE,BLUE][unit.slot%5]);
  U.panel(`Fighter${index}`,x,y,90,91,CARD,13,rim);
  U.text(`FighterGlyph${index}`,unit.name.slice(0,1),x,y+2,76,53,PAPER);
  if(unit.cc)U.text(`FighterCC${index}`,'✦',x+46,y+48,25,18,GOLD);
  U.progress(`HP${index}`,x,y-58,105,unit.hp/unit.maxHp,unit.side==='A'?GREEN:RED);
  U.progress(`Energy${index}`,x,y-69,105,(unit.energy||0)/100,GOLD);
  U.text(`FighterName${index}`,unit.name,x,y-88,116,17,unit.side==='A'?GOLD:DIM);
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
  U.text('BattleTitle',battleTitle(ctx),-82,592,520,27,GOLD);
  const timer=battleTimerInfo(ctx);
  U.text('BattleTimer',timer.text,292,592,150,23,timer.urgent?RED:DIM);
  U.scene('BattleCenterLine',g=>{
    g.strokeColor=tone('#795b34');g.lineWidth=2;
    g.moveTo(-330,8);g.lineTo(330,8);g.stroke();
  });
  U.panel('BattleVsBg',0,8,108,34,BG,4);
  U.text('BattleVs','对 阵',0,8,92,18,DIM);
  U.text('BattleLegend','绿条 生命 · 金条 怒气 · 卡边颜色=品质',-140,560,360,15,tone('#7c6a4e'));
  snapshot.forEach((unit,index)=>drawFighter(U,unit,index));
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
    ctx.ui.updateProgress(`HP${i}`,x,y-58,105,unit.hp/unit.maxHp);
    ctx.ui.updateProgress(`Energy${i}`,x,y-69,105,(unit.energy||0)/100);
    ctx.ui.setText(`FighterName${i}`,unit.alive?unit.name:`${unit.name} · 阵亡`);
  });
  ctx.ui.setText('BattleTimer',battleTimerInfo(ctx).text);
}

// 败北诊断：取终局快照里存活敌方的最高血量占比，给一条可执行提示（我方被团灭时同样带血量信息）
function defeatDiag(ctx: ScreenContext, r: any): string {
  const foes=(ctx.lastBattleSnapshot||[]).filter((u:any)=>u.side==='B'&&u.alive)
    .sort((a:any,b:any)=>(b.hp/b.maxHp)-(a.hp/a.maxHp));
  const top=foes[0];
  const topPct=top?Math.round(top.hp/top.maxHp*100):null;
  const timedOut=(r?.duration||0)>=config.BATTLE.TIME_LIMIT;
  if(topPct===null)return '我方全灭 · 尝试克制阵营或升级军械';
  if(topPct<=15)return `${top.name}只剩 ${topPct}% 血 · 再强化一轮即可过关`;
  if(timedOut)return `${top.name}仍剩 ${topPct}% 血 · 输出不足，试试克制阵营（魏→蜀→吴→群→魏）或升级军械`;
  return `我方被击败 · ${top.name}仍剩 ${topPct}% 血 · 试试克制阵营或调整布阵`;
}

export function resultView(ctx: ScreenContext) {
  const r=ctx.outcome,U=ctx.ui;
  drawField(U,ctx,ctx.lastBattleSnapshot||[]);
  U.rect('ResultDim',0,0,720,1280,new Color(0,0,0,185));
  U.panel('ResultPanel',0,-12,572,512,tone('#271b13'),16,GOLD);
  U.text('ResultTitle',r?.win?'凯  旋':'败  北',0,174,514,56,r?.win?GOLD:DIM);
  const reward=r?.reward||{};
  let lines: string[]=[];
  if(!r?.ok) lines=[r?.msg||'结算失败'];
  else if(ctx.battleMode==='arena') lines=r?.win?[`演武积分 ${reward.delta>=0?'+':''}${reward.delta||0} · 演武令 +${reward.tokens||0}`,
      ...(reward.rankUp?[`首达 ${reward.rankUp.name}！元宝 +${reward.rankUp.gem} · 精铁 +${reward.rankUp.iron}`]:[])]
    :[defeatDiag(ctx,r),`演武积分 ${reward.delta||0} · 演武令 +${reward.tokens||0}`];
  else if(ctx.battleMode==='tower') lines=r?.win?[`元宝 +${reward.gem||0} · 精铁 +${reward.iron||0} · 招募令 +${reward.scroll||0}`,`武将碎片 +${reward.shard||0}`]:[defeatDiag(ctx,r)];
  else if(ctx.battleMode==='hall'){
    const hr=reward.hallReward||{};
    if(!r?.win) lines=[defeatDiag(ctx,r),'名人堂挑战不限次数'];
    else {
      const parts:string[]=[];
      if(hr.firstKill)parts.push('首杀荣耀 +'+hr.honor);
      if(hr.firstThreeStar)parts.push('三星 +'+(hr.honor?hr.honor-20:10)+' 荣耀 · 碎片 +'+(hr.shard||0));
      if(hr.weeklyClear)parts.push('周全胜！演武令 +'+hr.token);
      lines=[parts.join(' · ')||'挑战成功（重复挑战不发奖）','名人堂荣耀 '+((store as any).hallInfo().honor)];
      if(hr.title)lines.push('获得称号：'+hr.title);
    }
  }
  else if(ctx.battleMode==='training') lines=[`练兵经验 +${r.gainedXP||0}`];
  else if(r?.win){
    if(reward.first){
      lines=[`元宝 +${reward.gem||0} · 铜钱 +${fmt.fmtNum(reward.gold||0)}${reward.scroll?` · 招募令 +${reward.scroll}`:''}`,
        `首通经验 +${r.gainedXP||0}`];
    } else lines=[`铜钱 +${fmt.fmtNum(reward.gold||0)} · 经验 +${r.gainedXP||0}`,'重复挑战不重复发放首通奖励'];
  }
  else lines=['普通奖励需凯旋后方可领取',defeatDiag(ctx,r)];
  lines.slice(0,3).forEach((line,i)=>U.text(`ResultLine${i}`,line,0,99-i*40,515,22,PAPER));
  const msLabels=(reward.milestones||[]).map((m:any)=>m.label);
  if(r?.win&&reward.finale)U.text('ResultFinale','第一期主线完成 · 主线 120/120',0,14,500,24,GOLD);
  else if(r?.win&&msLabels.length){
    U.text('ResultMilestone',`里程碑：${msLabels.join('；')} ›`,0,14,515,19,GOLD);
    U.tap('ResultMilestoneTap',0,14,515,30,()=>ctx.go(reward.milestones.some((m:any)=>m.kind==='armoryBox')?'armory':'bag'));
  }
  if(r?.win&&reward.first){
    const dropName=reward.armory&&!reward.armory.duplicate
      ?(items.CATALOG.find((x:any)=>x.id===reward.armory.itemId)?.name||'随机军械'):null;
    U.text('ResultDrop',dropName?`掉落军械：${dropName}`
      :reward.armory&&reward.armory.duplicate?`重复军械转化为精铁 +${reward.armory.iron}`
      :'随机军械：本次未掉落（65% 概率）',0,-24,515,18,DIM);
  }
  if(r?.win&&reward.armoryBox)U.text('ResultBox',`${['','R','SR','SSR'][reward.armoryBox]||''}军械自选箱 ×1 · 待选择`,0,-58,480,19,GOLD);
  const starText=ctx.battleMode==='campaign'&&r?.win?`评星 ${'★'.repeat(Math.max(1,Math.min(3,r.stars||1)))} · `:'';
  U.text('ResultDuration',`${starText}用时 ${Math.round((r?.duration||0)*10)/10} 秒`,0,-96,470,19,DIM);
  U.button('ResultBack','返回',-139,-165,232,59,()=>ctx.go(returnPage(ctx)),tone('#3a2b20'));
  U.button('ResultRetry','再战',139,-165,232,59,()=>ctx.battleMode==='arena'?ctx.startArenaBattle(ctx.battleDiff,ctx.battleArenaSeed):ctx.startBattle(ctx.battleMode,ctx.battleIndex,ctx.battleDiff),tone('#3a2b20'));
  if(!ctx.auto){
    if(ctx.battleMode==='campaign'&&!r?.win){
      const pity=store.summonPityInfo();
      U.text('ResultHint',`卡关提示：SSR 保底 ${pity.sinceSsr}/${pity.ssrHard} 抽 · 换克制阵营或升级军械后再战`,0,-135,540,16,DIM);
      U.button('ResultGrowth','推荐布阵',-139,-228,232,53,()=>ctx.go('formation'),tone('#4c6e57'));
      U.button('ResultNext','升级军械',139,-228,232,53,()=>ctx.go('armory'),tone('#4c6e57'));
    } else {
      if(r?.win)U.text('ResultDoneText','已 凯 旋',-139,-228,232,30,DIM);
      else U.button('ResultGrowth','查看武将',-139,-228,232,53,()=>ctx.go('heroes'),tone('#4c6e57'));
      if(!r?.win&&ctx.battleMode==='arena'){
        // 演武败北：'再战'已可重打，不再重复渲染'重新挑战'
        U.text('ResultArenaTip','调整布阵或升级军械后再来切磋',139,-228,232,20,DIM);
      } else {
        U.button('ResultNext',r?.win&&['campaign','tower'].includes(ctx.battleMode)?'挑战下一关':r?.win?'返回玩法':'重新挑战',139,-228,232,53,()=>{
          if(r?.win&&ctx.battleMode==='campaign')ctx.startBattle('campaign',ctx.battleIndex+1);
          else if(r?.win&&ctx.battleMode==='tower')ctx.startBattle('tower',ctx.battleIndex+1);
          else if(r?.win)ctx.go(returnPage(ctx));
          else if(ctx.battleMode==='arena')ctx.startArenaBattle(ctx.battleDiff,ctx.battleArenaSeed);
          else ctx.startBattle(ctx.battleMode,ctx.battleIndex,ctx.battleDiff);
        },tone('#b78b43'));
      }
    }
  }else U.text('NextAuto','自动出征 · 即将继续',0,-218,500,22,GOLD);
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
  U.button('SummaryBack','返回战役',0,-405,430,78,()=>ctx.go('campaign'),tone('#b78b43'));
}
